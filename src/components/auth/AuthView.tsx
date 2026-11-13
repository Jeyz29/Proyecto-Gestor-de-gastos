import React, { useState } from 'react';
import {
  WalletCards,
  Mail,
  Lock,
  LogIn,
  UserPlus,
  Sparkles,
  ShieldCheck,
  TrendingUp,
  ArrowRight,
} from 'lucide-react';
import { supabase, DEMO_CREDENTIALS } from '../../services/supabaseClient.ts';

export const AuthView: React.FC = () => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInErr) throw signInErr;
      } else {
        const { data, error: signUpErr } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (signUpErr) throw signUpErr;
        if (data.user && !data.session) {
          setMessage(
            'Cuenta creada. Si tienes confirmación por correo activa en Supabase, revisa tu bandeja de entrada o inicia sesión.'
          );
          setMode('login');
        }
      }
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
    setMessage(null);
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
    <div className="min-h-screen bg-surface flex flex-col justify-center items-center px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        {/* Cabecera de Marca G-Budget  */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-surface-container-lowest border border-slate-200/80 shadow-xs mx-auto">
            <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 shadow-xs">
              <img src="/icon.jpg" alt="G-Budget" className="w-full h-full object-cover" />
            </div>
            <div className="text-left">
              <span className="block text-lg font-bold text-on-surface tracking-tight leading-none">
                G-Budget
              </span>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-on-surface tracking-tight pt-1">
            Gestor de gastos
          </h1>
          <p className="text-xs sm:text-sm text-on-surface-variant max-w-xs mx-auto">
            Contabilidad personal multimoneda con tasas históricas oficiales y protección RLS.
          </p>
        </div>

        {/* Tarjeta Principal de Autenticación */}
        <div className="bg-surface-container-lowest rounded-2xl border border-slate-200/90 shadow-[0_1px_8px_rgba(15,23,42,0.05)] p-6 sm:p-7 space-y-5">
          {/* Conmutador Iniciar Sesión / Crear Cuenta */}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block font-mono text-xs font-medium text-on-surface mb-1.5">
                CORREO ELECTRÓNICO
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-outline absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@correo.com"
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-surface-container-low focus:bg-surface-container-lowest rounded-lg border border-slate-200 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block font-mono text-xs font-medium text-on-surface mb-1.5">
                CONTRASEÑA
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-outline absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={6}
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-surface-container-low focus:bg-surface-container-lowest rounded-lg border border-slate-200 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary transition-all"
                />
              </div>
            </div>

            {error && (
              <div className="text-xs text-on-error-container bg-error-container/60 border border-error/20 rounded-lg px-3.5 py-2.5">
                {error}
              </div>
            )}

            {message && (
              <div className="text-xs text-on-secondary-container bg-secondary-container/40 border border-secondary/20 rounded-lg px-3.5 py-2.5">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || demoLoading}
              className="w-full py-2.5 px-4 bg-secondary hover:bg-on-secondary-container disabled:opacity-50 text-white font-semibold text-sm rounded-lg shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>
                {loading
                  ? 'Procesando...'
                  : mode === 'login'
                    ? 'Acceder a G-Budget'
                    : 'Acceder'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Separador */}
          <div className="relative flex items-center py-1">
            <div className="grow border-t border-slate-200" />
            <span className="shrink-0 mx-3 font-mono text-[10px] font-medium text-outline uppercase tracking-wider">
              Acceso rápido para portafolio
            </span>
            <div className="grow border-t border-slate-200" />
          </div>

          {/* Botón de Cuenta Demo para Reclutadores */}
          <div className="bg-surface-container-low border border-surface-container-high rounded-xl p-4 space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-secondary" />
                  Modo Invitado / Demo Interactiva
                </h3>
                <p className="text-[11px] text-on-surface-variant mt-0.5">
                  Explora G-Budget con movimientos multimoneda de prueba sin registrarte y sin afectar datos privados.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDemoLogin}
              disabled={loading || demoLoading}
              className="w-full py-2 px-3 bg-primary hover:bg-slate-800 text-white font-mono font-medium text-xs rounded-lg transition-all shadow-2xs cursor-pointer"
            >
              {demoLoading
                ? 'Abriendo entorno de demostración...'
                : 'Entrar como Invitado / Demo (1 Clic)'}
            </button>
          </div>
        </div>

        {/* Pie de Seguridad */}
        <div className="flex items-center justify-center gap-4 font-mono text-[11px] text-on-surface-variant">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-secondary" />
            Fiscal Safe · Supabase RLS
          </span>
        </div>
      </div>
    </div>
  );
};
