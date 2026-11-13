import React, { useState } from 'react';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  ArrowRight,
  PieChart,
  CheckCircle2,
  PlayCircle,
  Sparkles,
} from 'lucide-react';
import { supabase, DEMO_CREDENTIALS } from '../../services/supabaseClient.ts';

export const AuthView: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInErr) throw signInErr;
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Ocurrió un error de autenticación';
      if (msg.toLowerCase().includes('invalid login credentials')) {
        setError('Correo o contraseña incorrectos.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setError(null);
    setDemoLoading(true);
    try {
      const { error: demoErr } = await supabase.auth.signInWithPassword({
        email: DEMO_CREDENTIALS.email,
        password: DEMO_CREDENTIALS.password,
      });
      if (demoErr) throw demoErr;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo iniciar la sesión de demostración'
      );
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <div className="bg-surface text-on-surface min-h-screen flex flex-col justify-between selection:bg-secondary-fixed selection:text-on-surface relative overflow-x-hidden">
      {/* Cabecera Superior Minimalista */}
      <header className="w-full py-6 px-6 sm:px-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg overflow-hidden shadow-xs shrink-0">
              <img
                src="/icon.jpg"
                alt="G-Budget"
                className="w-full h-full object-cover"
              />
            </div>
            <span className="text-xl font-semibold tracking-tight text-on-surface">
              G-Budget
            </span>
          </div>
        </div>
      </header>

      {/* Contenido Principal en 2 Columnas (Estilo Stitch G-Budget Personal Sign In) */}
      <main className="flex-1 flex flex-col items-center justify-center w-full px-4 sm:px-6 py-8">
        <div className="relative w-full max-w-6xl mx-auto flex flex-col items-center justify-center py-2">
          {/* Resplandores Ambientales Sutiles */}
          <div className="absolute -top-12 left-1/4 w-96 h-96 bg-secondary-fixed/30 rounded-full blur-3xl pointer-events-none -z-10" />
          <div className="absolute top-1/3 -right-16 w-80 h-80 bg-surface-container-high rounded-full blur-3xl pointer-events-none -z-10" />

          <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            {/* Columna Izquierda: Narrativa y Tarjeta de Telemetría (Visible en Desktop) */}
            <div className="hidden lg:flex lg:col-span-6 flex-col justify-between h-full py-4 pr-2">
              <div className="flex flex-col gap-6">
                <div className="inline-flex items-center gap-1.5 self-start px-3 py-1 bg-surface-container-low rounded-full">
                  <Sparkles className="w-3.5 h-3.5 text-secondary" />
                  <span className="font-mono text-xs text-secondary font-medium">
                    Control Financiero Multimoneda
                  </span>
                </div>

                <div className="flex flex-col gap-2">
                  <h1 className="text-4xl xl:text-[2.75rem] font-bold text-on-surface tracking-tight leading-[1.12]">
                    Registra tus gastos sin esfuerzo.{' '}
                    <span className="text-secondary">
                      Decisiones claras cada mes.
                    </span>
                  </h1>
                  <p className="text-sm text-on-surface-variant max-w-md mt-2 leading-relaxed">
                    Un gestor de gastos personal diseñado para mantener tu contabilidad en Dólares, Euros y Bolívares simple, clara y precisa.
                  </p>
                </div>

                {/* Tarjeta de Vista Previa Contable */}
                <div className="p-5 bg-surface-container-lowest rounded-xl shadow-xs flex flex-col gap-4 border border-outline-variant/30">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <PieChart className="w-4 h-4 text-secondary shrink-0" />
                      <span className="font-mono text-xs sm:text-sm text-on-surface font-semibold">
                        Balance Mensual BCV
                      </span>
                    </div>
                    <span className="font-mono text-[11px] sm:text-xs text-secondary bg-surface-container-low px-2.5 py-1 rounded-md font-semibold border border-secondary/20 shrink-0">
                      Al día · Tasas Oficiales
                    </span>
                  </div>

                  <div className="flex flex-col gap-2 pt-1">
                    <div className="flex justify-between items-center text-on-surface-variant gap-2">
                      <span className="font-mono text-xs whitespace-nowrap">
                        Conversión automática ($ · € · Bs.)
                      </span>
                      <span className="font-mono text-xs font-bold text-secondary font-tabular shrink-0">
                        100% Sincronizado
                      </span>
                    </div>
                    <div className="w-full bg-surface-container-high h-2.5 rounded-full overflow-hidden">
                      <div
                        className="bg-secondary h-full rounded-full transition-all duration-500"
                        style={{ width: '100%' }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-3 font-mono text-xs text-on-surface-variant border-t border-outline-variant/30">
                    <div className="flex flex-col">
                      <span className="text-[11px] text-outline">
                        Historial Cambiario
                      </span>
                      <span className="font-bold text-on-surface text-sm mt-0.5">
                        Fecha Valor BCV
                      </span>
                    </div>
                    <div className="flex flex-col text-right">
                      <span className="text-[11px] text-outline">
                        Aislamiento de Datos
                      </span>
                      <span className="font-bold text-secondary text-sm mt-0.5">
                        Supabase RLS
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-8">
                <div className="flex items-center gap-2 text-on-surface-variant font-mono text-xs">
                  <CheckCircle2 className="w-4 h-4 text-secondary shrink-0" />
                  <span>Base de datos privada y protegida con RLS</span>
                </div>
              </div>
            </div>

            {/* Columna Derecha: Tarjeta de Inicio de Sesión */}
            <div className="lg:col-span-6 w-full flex flex-col items-center">
              <div className="w-full max-w-md bg-surface-container-lowest rounded-xl shadow-md p-6 sm:p-10 flex flex-col gap-5 border border-outline-variant/20">
                {/* Encabezado de la Tarjeta */}
                <div className="flex flex-col gap-1 text-left">
                  <h2 className="text-2xl sm:text-[2rem] text-on-surface font-semibold tracking-tight leading-tight">
                    Bienvenido
                  </h2>
                  <p className="text-sm text-on-surface-variant">
                    Inicia sesión para gestionar tus gastos y consultar tu resumen mensual.
                  </p>
                </div>

                {/* Formulario con los mismos campos originales */}
                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="email"
                      className="font-mono text-xs text-on-surface font-medium"
                    >
                      Correo electrónico
                    </label>
                    <div className="relative flex items-center">
                      <Mail className="w-4 h-4 absolute left-3.5 text-on-surface-variant pointer-events-none" />
                      <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="tu@correo.com"
                        required
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-lg bg-surface-container-low text-on-surface text-sm placeholder:text-outline focus:outline-none focus:bg-surface-container-lowest focus:shadow-[0_0_0_2px_#006a61] transition-all"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="password"
                      className="font-mono text-xs text-on-surface font-medium"
                    >
                      Contraseña
                    </label>
                    <div className="relative flex items-center">
                      <Lock className="w-4 h-4 absolute left-3.5 text-on-surface-variant pointer-events-none" />
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        minLength={6}
                        required
                        className="w-full pl-10 pr-10 py-2.5 rounded-lg bg-surface-container-low text-on-surface text-sm font-mono placeholder:text-outline focus:outline-none focus:bg-surface-container-lowest focus:shadow-[0_0_0_2px_#006a61] transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        aria-label="Mostrar u ocultar contraseña"
                        className="absolute right-3 text-on-surface-variant hover:text-on-surface transition-colors p-1 cursor-pointer"
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <div className="text-xs text-on-error-container bg-error-container/60 border border-error/20 rounded-lg px-3.5 py-2.5">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading || demoLoading}
                    className="w-full mt-1 py-3 px-4 rounded-lg bg-primary-container text-on-primary hover:bg-on-surface disabled:opacity-50 font-semibold text-base tracking-tight flex items-center justify-center gap-2 transition-all shadow-md group cursor-pointer"
                  >
                    <span>
                      {loading ? 'Iniciando sesión...' : 'Acceder a G-Budget'}
                    </span>
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </button>
                </form>

                {/* Separador para Modo Invitado / Portafolio */}
                <div className="relative flex items-center py-1">
                  <div className="grow h-px bg-surface-container-high" />
                  <span className="shrink-0 mx-3 font-mono text-[11px] text-on-surface-variant uppercase tracking-wider">
                    Acceso rápido de demostración
                  </span>
                  <div className="grow h-px bg-surface-container-high" />
                </div>

                {/* Botón de Acceso Invitado / Demo (1 Clic) estilo Stitch */}
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={handleDemoLogin}
                    disabled={loading || demoLoading}
                    className="w-full py-2.5 px-4 rounded-lg bg-[#0D9488] hover:bg-[#0f766e] disabled:opacity-50 text-white font-mono text-sm font-semibold flex items-center justify-center gap-2 transition-all shadow-sm hover:shadow group cursor-pointer"
                  >
                    <PlayCircle className="w-4 h-4 text-white transition-transform group-hover:scale-110" />
                    <span>
                      {demoLoading
                        ? 'Abriendo entorno de demostración...'
                        : 'Entrar como Invitado'}
                    </span>
                  </button>
                  <p className="text-[11px] text-center text-on-surface-variant leading-relaxed">
                    Explora la aplicación con movimientos de prueba sin afectar datos privados.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Pie de Página Minimalista */}
      <footer className="w-full py-5 px-6 sm:px-10 border-t border-outline-variant/30">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-on-surface-variant">
          <div className="flex items-center gap-2 text-xs">
            <ShieldCheck className="w-4 h-4 text-secondary" />
            <span>Finanzas Personales Privadas · Protección Supabase RLS</span>
          </div>
          <div className="flex items-center gap-4 font-mono text-xs">
            <span className="text-outline">© 2026 G-Budget</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
