import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth';
import NotificationBell from './NotificationBell';

const LINKS = [
  { to: '/', label: 'Catalog', end: true },
  { to: '/my-datasets', label: 'My Datasets' },
  { to: '/requests/received', label: 'Requests Received' },
  { to: '/requests/sent', label: 'My Requests' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  const linkClass = ({ isActive }) =>
    `rounded-lg px-3 py-2 text-sm font-medium transition ${isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'}`;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-600 font-bold text-white">S</span>
            <span className="text-lg font-semibold text-slate-900">DataShare</span>
          </Link>

          <nav className="ml-4 hidden items-center gap-1 md:flex">
            {LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className={linkClass}>
                {l.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Link to="/publish" className="btn-primary hidden sm:inline-flex">
              + Publish dataset
            </Link>
            <NotificationBell />
            <div className="hidden items-center gap-3 border-l border-slate-200 pl-3 md:flex">
              <span className="max-w-[9rem] truncate text-sm text-slate-600">{user?.name}</span>
              <button className="text-sm font-medium text-slate-500 hover:text-slate-900" onClick={logout}>
                Sign out
              </button>
            </div>
            <button className="rounded p-2 hover:bg-slate-100 md:hidden" onClick={() => setOpen((o) => !o)} aria-label="Toggle menu">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {open && (
          <div className="space-y-1 border-t border-slate-100 px-4 py-3 md:hidden">
            {LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className={linkClass} onClick={() => setOpen(false)}>
                {l.label}
              </NavLink>
            ))}
            <NavLink to="/publish" className={linkClass} onClick={() => setOpen(false)}>
              Publish dataset
            </NavLink>
            <button className="block w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-600 hover:bg-slate-100" onClick={logout}>
              Sign out ({user?.name})
            </button>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}
