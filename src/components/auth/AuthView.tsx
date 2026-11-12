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
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        {/* Cabecera de Marca */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-md mx-auto">
            <WalletCards className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Gestor de Gastos & BCV
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 max-w-xs mx-auto">
            Control financiero multimoneda (USD, EUR y Bs.) con tasas históricas oficiales y protección Row-Level Security en Supabase.
          </p>
        </div>

        {/* Tarjeta Principal de Autenticación */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 sm:p-8 space-y-6">
          {/* Conmutador Iniciar Sesión / Crear Cuenta */}
          <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-2xl text-xs sm:text-sm font-medium">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
                setMessage(null);
              }}
              className={`py-2 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                mode === 'login'
                  ? 'bg-white text-indigo-600 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LogIn className="w-4 h-4" />
              Iniciar Sesión
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setError(null);
                setMessage(null);
              }}
              className={`py-2 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                mode === 'signup'
                  ? 'bg-white text-indigo-600 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserPlus className="w-4 h-4" />
              Crear Cuenta
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Correo Electrónico
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@correo.com"
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={6}
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {error && (
              <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">
                {error}
              </div>
            )}

            {message && (
              <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-2.5">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || demoLoading}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-sm rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>
                {loading
                  ? 'Procesando...'
                  : mode === 'login'
                  ? 'Entrar a mi cuenta'
                  : 'Registrar cuenta'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Separador */}
          <div className="relative flex items-center py-1">
            <div className="grow border-t border-slate-200" />
            <span className="shrink-0 mx-3 text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              Acceso rápido para portafolio
            </span>
            <div className="grow border-t border-slate-200" />
          </div>

          {/* Botón de Cuenta Demo para Reclutadores */}
          <div className="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-4 space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  Modo Invitado / Demo interactiva
                </h3>
                <p className="text-[11px] text-indigo-700/90 mt-0.5">
                  Explora el dashboard con movimientos multimoneda de prueba sin registrarte y sin afectar datos privados.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDemoLogin}
              disabled={loading || demoLoading}
              className="w-full py-2 px-3 bg-white hover:bg-indigo-600 text-indigo-700 hover:text-white border border-indigo-200 hover:border-indigo-600 font-semibold text-xs rounded-xl transition-all shadow-2xs cursor-pointer"
            >
              {demoLoading
                ? 'Abriendo entorno de demostración...'
                : 'Entrar como Invitado / Demo (1 Clic)'}
            </button>
          </div>
        </div>

        {/* Pie de Seguridad */}
        <div className="flex items-center justify-center gap-4 text-[11px] text-slate-400">
          <span className="inline-flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            Supabase Auth + RLS
          </span>
          <span>•</span>
          <span className="inline-flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-indigo-500" />
            Tasas Oficiales BCV
          </span>
        </div>
      </div>
    </div>
  );
};
