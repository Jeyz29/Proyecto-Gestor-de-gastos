import express from 'express';
import cors from 'cors';
import crypto from 'node:crypto';
import { db } from './db.ts';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// ==================== TASAS BCV (USD y EUR OFICIAL) ====================

interface BcvRateInfo {
  rate: number;    // Tasa USD -> Bs.
  eurRate: number; // Tasa EUR -> Bs.
  updatedAt: string;
  source: 'bcv-api' | 'cache' | 'manual';
}

function getSavedBcvRate(): BcvRateInfo | null {
  const row = db
    .prepare("SELECT value, updated_at FROM settings WHERE key = 'bcv_rate'")
    .get() as { value: string; updated_at: string } | undefined;

  if (!row) return null;
  try {
    const parsed = JSON.parse(row.value);
    return {
      rate: Number(parsed.rate) || 0,
      eurRate: Number(parsed.eurRate) || 0,
      updatedAt: parsed.updatedAt || row.updated_at,
      source: parsed.source || 'cache',
    };
  } catch {
    return null;
  }
}

function saveBcvRate(info: BcvRateInfo): void {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO settings (key, value, updated_at)
     VALUES ('bcv_rate', ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).run(JSON.stringify(info), now);
}

async function fetchBcvRateFromInternet(): Promise<BcvRateInfo> {
  // Consulta simultáneamente Dólar y Euro oficiales del BCV en ve.dolarapi.com
  const [usdRes, eurRes] = await Promise.all([
    fetch('https://ve.dolarapi.com/v1/dolares/oficial', {
      signal: AbortSignal.timeout(6000),
    }),
    fetch('https://ve.dolarapi.com/v1/euros/oficial', {
      signal: AbortSignal.timeout(6000),
    }),
  ]);

  if (!usdRes.ok || !eurRes.ok) {
    throw new Error('Error HTTP al consultar API de cotizaciones BCV');
  }

  const usdData = (await usdRes.json()) as {
    promedio?: number;
    fechaActualizacion?: string;
  };
  const eurData = (await eurRes.json()) as {
    promedio?: number;
    fechaActualizacion?: string;
  };

  if (!usdData.promedio || typeof usdData.promedio !== 'number') {
    throw new Error('Respuesta inválida de Dólar BCV');
  }

  const info: BcvRateInfo = {
    rate: Number(usdData.promedio.toFixed(4)),
    eurRate:
      eurData.promedio && typeof eurData.promedio === 'number'
        ? Number(eurData.promedio.toFixed(4))
        : 0,
    updatedAt: usdData.fechaActualizacion || new Date().toISOString(),
    source: 'bcv-api',
  };

  saveBcvRate(info);
  return info;
}

// Obtener tasas actuales del BCV (USD y EUR)
app.get('/api/bcv-rate', async (req, res) => {
  const forceRefresh = req.query.refresh === 'true';
  try {
    const saved = getSavedBcvRate();
    if (saved && saved.source === 'manual' && !forceRefresh && saved.eurRate > 0) {
      res.json(saved);
      return;
    }

    const liveRate = await fetchBcvRateFromInternet();
    res.json(liveRate);
  } catch (error) {
    console.warn('No se pudo conectar con API BCV en vivo, usando caché local:', error);
    const cached = getSavedBcvRate();
    if (cached) {
      res.json({ ...cached, source: 'cache' });
      return;
    }
    res.status(503).json({
      error: 'No se pudo obtener las tasas del BCV y no hay tasas guardadas aún.',
    });
  }
});

// Permitir actualizar o fijar manualmente las tasas USD y EUR si algún día no hay internet
app.put('/api/bcv-rate', (req, res) => {
  try {
    const { rate, eurRate } = req.body;
    const numericUsd = Number(rate);
    const numericEur = Number(eurRate);

    if (isNaN(numericUsd) || numericUsd <= 0 || isNaN(numericEur) || numericEur <= 0) {
      res.status(400).json({ error: 'Las tasas de USD y EUR deben ser mayores a 0' });
      return;
    }

    const info: BcvRateInfo = {
      rate: Number(numericUsd.toFixed(4)),
      eurRate: Number(numericEur.toFixed(4)),
      updatedAt: new Date().toISOString(),
      source: 'manual',
    };
    saveBcvRate(info);
    res.json(info);
  } catch (error) {
    console.error('Error al guardar tasas manuales:', error);
    res.status(500).json({ error: 'Error al guardar las tasas' });
  }
});

// Caché en memoria para el historial del BCV (evita descargar todo el historial en cada cambio de fecha)
interface HistoricalEntry {
  fecha: string;
  promedio: number;
}

let historyCache: {
  fetchedAt: number;
  usd: HistoricalEntry[];
  eur: HistoricalEntry[];
} | null = null;

async function getHistoricalBcvLists() {
  const now = Date.now();
  // Refrescar caché cada 30 minutos
  if (historyCache && now - historyCache.fetchedAt < 30 * 60 * 1000) {
    return historyCache;
  }

  const [usdRes, eurRes] = await Promise.all([
    fetch('https://ve.dolarapi.com/v1/historicos/dolares/oficial', {
      signal: AbortSignal.timeout(8000),
    }),
    fetch('https://ve.dolarapi.com/v1/historicos/euros/oficial', {
      signal: AbortSignal.timeout(8000),
    }),
  ]);

  if (!usdRes.ok || !eurRes.ok) {
    throw new Error('No se pudo consultar el historial del BCV');
  }

  const usdList = (await usdRes.json()) as HistoricalEntry[];
  const eurList = (await eurRes.json()) as HistoricalEntry[];

  historyCache = {
    fetchedAt: now,
    usd: usdList.filter((i) => i.fecha && typeof i.promedio === 'number'),
    eur: eurList.filter((i) => i.fecha && typeof i.promedio === 'number'),
  };

  return historyCache;
}

function findRateForDate(list: HistoricalEntry[], targetDate: string): {
  valueDateEntry: HistoricalEntry | null;
  publicationEntry: HistoricalEntry | null;
} {
  if (list.length === 0) return { valueDateEntry: null, publicationEntry: null };

  // Ordenar cronológicamente por seguridad
  const sorted = [...list].sort((a, b) => a.fecha.localeCompare(b.fecha));

  // 1. Entrada por Fecha Valor (<= targetDate)
  let valueIdx = -1;
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].fecha <= targetDate) {
      valueIdx = i;
    } else {
      break;
    }
  }

  const valueDateEntry = valueIdx >= 0 ? sorted[valueIdx] : null;
  // 2. En la API del BCV, la tasa publicada en la tarde de un día hábil (ej. viernes 2 oct: 871.3689)
  // aparece etiquetada con su "Fecha Valor" del siguiente día hábil bancario (ej. lunes 5 oct).
  const publicationEntry =
    valueIdx >= 0 && valueIdx + 1 < sorted.length ? sorted[valueIdx + 1] : valueDateEntry;

  return { valueDateEntry, publicationEntry };
}

// Obtener la tasa oficial del BCV correspondiente a una fecha específica (YYYY-MM-DD)
app.get('/api/bcv-rate/history', async (req, res) => {
  try {
    const { date } = req.query;
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ error: 'Formato de fecha inválido. Usa YYYY-MM-DD' });
      return;
    }

    const { usd, eur } = await getHistoricalBcvLists();
    const usdMatches = findRateForDate(usd, date);
    const eurMatches = findRateForDate(eur, date);

    // Usamos la tasa publicada ese día (cierre de mesa de cambio de ese día) como principal
    const primaryUsd = usdMatches.publicationEntry || usdMatches.valueDateEntry;
    const primaryEur = eurMatches.publicationEntry || eurMatches.valueDateEntry;

    if (!primaryUsd) {
      const fallback = getSavedBcvRate();
      res.json({
        date,
        effectiveDate: date,
        rate: fallback?.rate || 0,
        eurRate: fallback?.eurRate || 0,
        valueDateRate: fallback?.rate || 0,
        valueDateEurRate: fallback?.eurRate || 0,
        source: 'fallback',
      });
      return;
    }

    res.json({
      date,
      effectiveDate: primaryUsd.fecha,
      rate: Number(primaryUsd.promedio.toFixed(4)),
      eurRate: primaryEur ? Number(primaryEur.promedio.toFixed(4)) : 0,
      valueDateRate: usdMatches.valueDateEntry
        ? Number(usdMatches.valueDateEntry.promedio.toFixed(4))
        : Number(primaryUsd.promedio.toFixed(4)),
      valueDateEurRate: eurMatches.valueDateEntry
        ? Number(eurMatches.valueDateEntry.promedio.toFixed(4))
        : 0,
      source: 'bcv-history',
    });
  } catch (error) {
    console.warn('Error al buscar tasa histórica BCV:', error);
    const fallback = getSavedBcvRate();
    res.json({
      date: req.query.date,
      effectiveDate: req.query.date,
      rate: fallback?.rate || 0,
      eurRate: fallback?.eurRate || 0,
      valueDateRate: fallback?.rate || 0,
      valueDateEurRate: fallback?.eurRate || 0,
      source: 'fallback',
    });
  }
});

// ==================== CATEGORÍAS ====================

// Obtener todas las categorías
app.get('/api/categories', (_req, res) => {
  try {
    const stmt = db.prepare('SELECT * FROM categories ORDER BY created_at ASC');
    const categories = stmt.all();
    res.json(categories);
  } catch (error) {
    console.error('Error al obtener categorías:', error);
    res.status(500).json({ error: 'Error al obtener las categorías' });
  }
});

// Crear una nueva categoría
app.post('/api/categories', (req, res) => {
  try {
    const { name, color, icon = 'tag' } = req.body;
    if (!name || !color) {
      res.status(400).json({ error: 'El nombre y el color son obligatorios' });
      return;
    }

    const id = crypto.randomUUID();
    const created_at = new Date().toISOString();

    const stmt = db.prepare(
      'INSERT INTO categories (id, name, color, icon, created_at) VALUES (?, ?, ?, ?, ?)'
    );
    stmt.run(id, name.trim(), color, icon, created_at);

    res.status(201).json({ id, name: name.trim(), color, icon, created_at });
  } catch (error) {
    console.error('Error al crear categoría:', error);
    res.status(500).json({ error: 'Error al crear la categoría' });
  }
});

// Actualizar una categoría
app.put('/api/categories/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, color, icon = 'tag' } = req.body;
    if (!name || !color) {
      res.status(400).json({ error: 'El nombre y el color son obligatorios' });
      return;
    }

    const stmt = db.prepare(
      'UPDATE categories SET name = ?, color = ?, icon = ? WHERE id = ?'
    );
    const result = stmt.run(name.trim(), color, icon, id);

    if (result.changes === 0) {
      res.status(404).json({ error: 'Categoría no encontrada' });
      return;
    }

    res.json({ id, name: name.trim(), color, icon });
  } catch (error) {
    console.error('Error al actualizar categoría:', error);
    res.status(500).json({ error: 'Error al actualizar la categoría' });
  }
});

// Eliminar una categoría
app.delete('/api/categories/:id', (req, res) => {
  try {
    const { id } = req.params;

    // Verificar si tiene gastos o suscripciones asociadas
    const checkStmt = db.prepare('SELECT COUNT(*) as total FROM expenses WHERE category_id = ?');
    const usage = checkStmt.get(id) as { total: number };
    const subCheckStmt = db.prepare('SELECT COUNT(*) as total FROM subscriptions WHERE category_id = ?');
    const subUsage = subCheckStmt.get(id) as { total: number };

    if (usage.total > 0 || subUsage.total > 0) {
      res.status(400).json({
        error: `No se puede eliminar porque tiene ${usage.total} gasto(s) y ${subUsage.total} suscripción(es) asociada(s).`,
      });
      return;
    }

    const stmt = db.prepare('DELETE FROM categories WHERE id = ?');
    stmt.run(id);
    res.status(204).send();
  } catch (error) {
    console.error('Error al eliminar categoría:', error);
    res.status(500).json({ error: 'Error al eliminar la categoría' });
  }
});

// ==================== SUBCATEGORÍAS ====================

// Obtener todas las subcategorías
app.get('/api/subcategories', (_req, res) => {
  try {
    const stmt = db.prepare('SELECT * FROM subcategories ORDER BY created_at ASC');
    const subcategories = stmt.all();
    res.json(subcategories);
  } catch (error) {
    console.error('Error al obtener subcategorías:', error);
    res.status(500).json({ error: 'Error al obtener las subcategorías' });
  }
});

// Crear una nueva subcategoría
app.post('/api/subcategories', (req, res) => {
  try {
    const { category_id, name } = req.body;
    if (!category_id || !name || !name.trim()) {
      res.status(400).json({ error: 'La categoría padre y el nombre son obligatorios' });
      return;
    }

    const id = crypto.randomUUID();
    const created_at = new Date().toISOString();

    const stmt = db.prepare(
      'INSERT INTO subcategories (id, category_id, name, created_at) VALUES (?, ?, ?, ?)'
    );
    stmt.run(id, category_id, name.trim(), created_at);

    res.status(201).json({ id, category_id, name: name.trim(), created_at });
  } catch (error) {
    console.error('Error al crear subcategoría:', error);
    res.status(500).json({ error: 'Error al crear la subcategoría' });
  }
});

// Actualizar una subcategoría (renombrar)
app.put('/api/subcategories/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    if (!name || !name.trim()) {
      res.status(400).json({ error: 'El nombre es obligatorio' });
      return;
    }

    const stmt = db.prepare('UPDATE subcategories SET name = ? WHERE id = ?');
    const result = stmt.run(name.trim(), id);

    if (result.changes === 0) {
      res.status(404).json({ error: 'Subcategoría no encontrada' });
      return;
    }

    const updated = db.prepare('SELECT * FROM subcategories WHERE id = ?').get(id);
    res.json(updated);
  } catch (error) {
    console.error('Error al actualizar subcategoría:', error);
    res.status(500).json({ error: 'Error al actualizar la subcategoría' });
  }
});

// Eliminar una subcategoría (los gastos asociados quedan en "General" de la categoría padre)
app.delete('/api/subcategories/:id', (req, res) => {
  try {
    const { id } = req.params;
    const stmt = db.prepare('DELETE FROM subcategories WHERE id = ?');
    stmt.run(id);
    res.status(204).send();
  } catch (error) {
    console.error('Error al eliminar subcategoría:', error);
    res.status(500).json({ error: 'Error al eliminar la subcategoría' });
  }
});

// ==================== SUSCRIPCIONES (MENSUALES Y ANUALES) ====================

// Obtener todas las suscripciones
app.get('/api/subscriptions', (_req, res) => {
  try {
    const stmt = db.prepare(`
      SELECT 
        sub.*,
        c.name as category_name,
        c.color as category_color,
        c.icon as category_icon,
        s.name as subcategory_name
      FROM subscriptions sub
      JOIN categories c ON sub.category_id = c.id
      LEFT JOIN subcategories s ON sub.subcategory_id = s.id
      ORDER BY sub.billing_cycle ASC, sub.created_at DESC
    `);
    const rows = stmt.all();
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener suscripciones:', error);
    res.status(500).json({ error: 'Error al obtener las suscripciones' });
  }
});

// Crear una nueva suscripción
app.post('/api/subscriptions', (req, res) => {
  try {
    const {
      name,
      category_id,
      subcategory_id,
      amount,
      currency = 'USD',
      billing_cycle = 'monthly',
      include_in_monthly = 1,
      billing_day = 1,
    } = req.body;

    if (!name || !category_id || amount === undefined) {
      res.status(400).json({ error: 'Nombre, categoría y monto son obligatorios' });
      return;
    }

    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      res.status(400).json({ error: 'El monto debe ser mayor a 0' });
      return;
    }

    const id = crypto.randomUUID();
    const created_at = new Date().toISOString();
    const normalizedSubId =
      typeof subcategory_id === 'string' && subcategory_id.trim() !== ''
        ? subcategory_id.trim()
        : null;

    const cycle = billing_cycle === 'annual' ? 'annual' : 'monthly';
    const includeFlag = include_in_monthly ? 1 : 0;
    const day = Math.min(31, Math.max(1, Number(billing_day) || 1));

    const insertStmt = db.prepare(`
      INSERT INTO subscriptions (
        id, name, category_id, subcategory_id, amount, currency, billing_cycle, include_in_monthly, billing_day, active, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    `);

    insertStmt.run(
      id,
      name.trim(),
      category_id,
      normalizedSubId,
      Number(numericAmount.toFixed(2)),
      currency === 'EUR' ? 'EUR' : 'USD',
      cycle,
      includeFlag,
      day,
      created_at
    );

    const created = db
      .prepare(`
        SELECT 
          sub.*,
          c.name as category_name,
          c.color as category_color,
          c.icon as category_icon,
          s.name as subcategory_name
        FROM subscriptions sub
        JOIN categories c ON sub.category_id = c.id
        LEFT JOIN subcategories s ON sub.subcategory_id = s.id
        WHERE sub.id = ?
      `)
      .get(id);

    res.status(201).json(created);
  } catch (error) {
    console.error('Error al crear suscripción:', error);
    res.status(500).json({ error: 'Error al guardar la suscripción' });
  }
});

// Alternar si una suscripción se incluye en el gasto mensual o se mantiene en el apartado anual/separado
app.patch('/api/subscriptions/:id/toggle-monthly', (req, res) => {
  try {
    const { id } = req.params;
    const { include_in_monthly } = req.body;
    const includeFlag = include_in_monthly ? 1 : 0;

    const stmt = db.prepare(
      'UPDATE subscriptions SET include_in_monthly = ? WHERE id = ?'
    );
    const result = stmt.run(includeFlag, id);

    if (result.changes === 0) {
      res.status(404).json({ error: 'Suscripción no encontrada' });
      return;
    }

    const updated = db
      .prepare(`
        SELECT 
          sub.*,
          c.name as category_name,
          c.color as category_color,
          c.icon as category_icon,
          s.name as subcategory_name
        FROM subscriptions sub
        JOIN categories c ON sub.category_id = c.id
        LEFT JOIN subcategories s ON sub.subcategory_id = s.id
        WHERE sub.id = ?
      `)
      .get(id);

    res.json(updated);
  } catch (error) {
    console.error('Error al actualizar modo de suscripción:', error);
    res.status(500).json({ error: 'Error al actualizar la suscripción' });
  }
});

// Eliminar una suscripción
app.delete('/api/subscriptions/:id', (req, res) => {
  try {
    const { id } = req.params;
    const stmt = db.prepare('DELETE FROM subscriptions WHERE id = ?');
    stmt.run(id);
    res.status(204).send();
  } catch (error) {
    console.error('Error al eliminar suscripción:', error);
    res.status(500).json({ error: 'Error al eliminar la suscripción' });
  }
});

// ==================== GASTOS ====================

// Obtener gastos (opcionalmente filtrados por mes en formato YYYY-MM)
app.get('/api/expenses', (req, res) => {
  try {
    const { month } = req.query; // Ej: "2026-10"

    let query = `
      SELECT 
        e.id,
        e.category_id,
        e.subcategory_id,
        e.amount,
        e.exchange_rate,
        e.exchange_rate_eur,
        e.amount_ves,
        e.amount_eur,
        e.description,
        e.expense_date,
        e.created_at,
        c.name as category_name,
        c.color as category_color,
        c.icon as category_icon,
        s.name as subcategory_name
      FROM expenses e
      JOIN categories c ON e.category_id = c.id
      LEFT JOIN subcategories s ON e.subcategory_id = s.id
    `;

    const params: string[] = [];
    if (typeof month === 'string' && /^\d{4}-\d{2}$/.test(month)) {
      query += ` WHERE e.expense_date LIKE ?`;
      params.push(`${month}-%`);
    }

    query += ` ORDER BY e.expense_date DESC, e.created_at DESC`;

    const stmt = db.prepare(query);
    const expenses = stmt.all(...params);
    res.json(expenses);
  } catch (error) {
    console.error('Error al obtener gastos:', error);
    res.status(500).json({ error: 'Error al obtener los gastos' });
  }
});

// Obtener resumen histórico agrupado por mes, categoría y subcategoría para comparativas
app.get('/api/expenses/analytics', (_req, res) => {
  try {
    const stmt = db.prepare(`
      SELECT
        substr(e.expense_date, 1, 7) as month,
        e.category_id,
        c.name as category_name,
        c.color as category_color,
        e.subcategory_id,
        s.name as subcategory_name,
        SUM(e.amount) as total_usd,
        SUM(e.amount_eur) as total_eur,
        SUM(e.amount_ves) as total_ves,
        COUNT(e.id) as expense_count
      FROM expenses e
      JOIN categories c ON e.category_id = c.id
      LEFT JOIN subcategories s ON e.subcategory_id = s.id
      GROUP BY month, e.category_id, e.subcategory_id
      ORDER BY month ASC
    `);
    const rows = stmt.all();
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener analíticas mensuales:', error);
    res.status(500).json({ error: 'Error al obtener el historial comparativo' });
  }
});

// Crear un nuevo gasto
app.post('/api/expenses', (req, res) => {
  try {
    const {
      category_id,
      subcategory_id,
      amount,
      exchange_rate,
      exchange_rate_eur,
      amount_ves,
      amount_eur,
      description,
      expense_date,
    } = req.body;

    if (!category_id || amount === undefined || !description || !expense_date) {
      res.status(400).json({ error: 'Todos los campos son obligatorios' });
      return;
    }

    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      res.status(400).json({ error: 'El monto debe ser un número mayor a 0' });
      return;
    }

    const saved = getSavedBcvRate();
    const savedUsdRate = saved?.rate || 0;
    const savedEurRate = saved?.eurRate || 0;

    const rateUsdUsed =
      exchange_rate !== undefined && Number(exchange_rate) > 0
        ? Number(exchange_rate)
        : savedUsdRate;

    const rateEurUsed =
      exchange_rate_eur !== undefined && Number(exchange_rate_eur) > 0
        ? Number(exchange_rate_eur)
        : savedEurRate;

    const calculatedVes =
      amount_ves !== undefined && Number(amount_ves) > 0
        ? Number(amount_ves)
        : Number((numericAmount * rateUsdUsed).toFixed(2));

    const calculatedEur =
      amount_eur !== undefined && Number(amount_eur) > 0
        ? Number(amount_eur)
        : rateEurUsed > 0
        ? Number((calculatedVes / rateEurUsed).toFixed(2))
        : 0;

    const id = crypto.randomUUID();
    const created_at = new Date().toISOString();
    const normalizedSubId =
      typeof subcategory_id === 'string' && subcategory_id.trim() !== ''
        ? subcategory_id.trim()
        : null;

    const insertStmt = db.prepare(
      `INSERT INTO expenses (
        id, category_id, subcategory_id, amount, exchange_rate, exchange_rate_eur, amount_ves, amount_eur, description, expense_date, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    insertStmt.run(
      id,
      category_id,
      normalizedSubId,
      Number(numericAmount.toFixed(2)),
      Number(rateUsdUsed.toFixed(4)),
      Number(rateEurUsed.toFixed(4)),
      calculatedVes,
      calculatedEur,
      description.trim(),
      expense_date,
      created_at
    );

    // Devolver el gasto con datos de su categoría y subcategoría
    const getStmt = db.prepare(`
      SELECT 
        e.*,
        c.name as category_name,
        c.color as category_color,
        c.icon as category_icon,
        s.name as subcategory_name
      FROM expenses e
      JOIN categories c ON e.category_id = c.id
      LEFT JOIN subcategories s ON e.subcategory_id = s.id
      WHERE e.id = ?
    `);
    const createdExpense = getStmt.get(id);

    res.status(201).json(createdExpense);
  } catch (error) {
    console.error('Error al crear gasto:', error);
    res.status(500).json({ error: 'Error al guardar el gasto' });
  }
});

// Actualizar un gasto existente
app.put('/api/expenses/:id', (req, res) => {
  try {
    const { id } = req.params;
    const {
      category_id,
      subcategory_id,
      amount,
      exchange_rate,
      exchange_rate_eur,
      amount_ves,
      amount_eur,
      description,
      expense_date,
    } = req.body;

    if (!category_id || amount === undefined || !description || !expense_date) {
      res.status(400).json({ error: 'Todos los campos son obligatorios' });
      return;
    }

    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      res.status(400).json({ error: 'El monto debe ser un número mayor a 0' });
      return;
    }

    const saved = getSavedBcvRate();
    const savedUsdRate = saved?.rate || 0;
    const savedEurRate = saved?.eurRate || 0;

    const rateUsdUsed =
      exchange_rate !== undefined && Number(exchange_rate) > 0
        ? Number(exchange_rate)
        : savedUsdRate;

    const rateEurUsed =
      exchange_rate_eur !== undefined && Number(exchange_rate_eur) > 0
        ? Number(exchange_rate_eur)
        : savedEurRate;

    const calculatedVes =
      amount_ves !== undefined && Number(amount_ves) > 0
        ? Number(amount_ves)
        : Number((numericAmount * rateUsdUsed).toFixed(2));

    const calculatedEur =
      amount_eur !== undefined && Number(amount_eur) > 0
        ? Number(amount_eur)
        : rateEurUsed > 0
        ? Number((calculatedVes / rateEurUsed).toFixed(2))
        : 0;

    const normalizedSubId =
      typeof subcategory_id === 'string' && subcategory_id.trim() !== ''
        ? subcategory_id.trim()
        : null;

    const updateStmt = db.prepare(`
      UPDATE expenses
      SET category_id = ?,
          subcategory_id = ?,
          amount = ?,
          exchange_rate = ?,
          exchange_rate_eur = ?,
          amount_ves = ?,
          amount_eur = ?,
          description = ?,
          expense_date = ?
      WHERE id = ?
    `);

    const result = updateStmt.run(
      category_id,
      normalizedSubId,
      Number(numericAmount.toFixed(2)),
      Number(rateUsdUsed.toFixed(4)),
      Number(rateEurUsed.toFixed(4)),
      calculatedVes,
      calculatedEur,
      description.trim(),
      expense_date,
      id
    );

    if (result.changes === 0) {
      res.status(404).json({ error: 'Gasto no encontrado' });
      return;
    }

    const updatedExpense = db
      .prepare(`
        SELECT 
          e.*,
          c.name as category_name,
          c.color as category_color,
          c.icon as category_icon,
          s.name as subcategory_name
        FROM expenses e
        JOIN categories c ON e.category_id = c.id
        LEFT JOIN subcategories s ON e.subcategory_id = s.id
        WHERE e.id = ?
      `)
      .get(id);

    res.json(updatedExpense);
  } catch (error) {
    console.error('Error al actualizar gasto:', error);
    res.status(500).json({ error: 'Error al actualizar el gasto' });
  }
});

// Eliminar un gasto
app.delete('/api/expenses/:id', (req, res) => {
  try {
    const { id } = req.params;
    const stmt = db.prepare('DELETE FROM expenses WHERE id = ?');
    stmt.run(id);
    res.status(204).send();
  } catch (error) {
    console.error('Error al eliminar gasto:', error);
    res.status(500).json({ error: 'Error al eliminar el gasto' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor backend y SQLite corriendo en http://localhost:${PORT}`);
});
