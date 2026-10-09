import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth';
import { errMsg } from '../api';

// Mirrors the backend rules (the backend is still the source of truth).
const RULES = [
  { label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { label: 'One lowercase letter', test: (p) => /[a-z]/.test(p) },
  { label: 'One uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { label: 'One number', test: (p) => /[0-9]/.test(p) },
];

export default function Signup() {
  const { signup } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const passwordOk = RULES.every((r) => r.test(form.password));
  const nameOk = form.name.trim().length >= 2;
  const emailOk = /^\S+@\S+\.\S+$/.test(form.email.trim());

  async function onSubmit(e) {
    e.preventDefault();
    setTouched(true);
    setError('');
    if (!nameOk || !emailOk || !passwordOk) return;
    setBusy(true);
    try {
      await signup(form.name.trim(), form.email.trim(), form.password);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-gradient-to-br from-brand-50 via-stone-50 to-white p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-brand-600 text-xl font-bold text-white">S</span>
          <h1 className="mt-4 text-2xl font-semibold text-slate-900">Create your account</h1>
          <p className="mt-1 text-sm text-slate-500">Publish your own datasets and use others'</p>
        </div>

        <form onSubmit={onSubmit} className="card space-y-4 p-6" noValidate>
          {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="name">Full name</label>
            <input id="name" className="input" value={form.name} onChange={set('name')} autoComplete="name" />
            {touched && !nameOk && <p className="mt-1 text-xs text-red-600">Please enter your name (min 2 characters).</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="email">Email</label>
            <input id="email" type="email" className="input" value={form.email} onChange={set('email')} autoComplete="email" />
            {touched && !emailOk && <p className="mt-1 text-xs text-red-600">Enter a valid email address.</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="password">Password</label>
            <input id="password" type="password" className="input" value={form.password} onChange={set('password')} autoComplete="new-password" />
            <ul className="mt-2 space-y-0.5 text-xs">
              {RULES.map((r) => {
                const ok = r.test(form.password);
                return (
                  <li key={r.label} className={ok ? 'text-emerald-600' : touched ? 'text-red-600' : 'text-slate-500'}>
                    {ok ? '✓' : '○'} {r.label}
                  </li>
                );
              })}
            </ul>
          </div>

          <button className="btn-primary w-full" disabled={busy}>
            {busy ? 'Creating account...' : 'Sign up'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-600">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-brand-700 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
