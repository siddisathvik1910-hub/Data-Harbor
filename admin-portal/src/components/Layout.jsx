import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth';

const NAV = [
  { to: '/', label: 'Dashboard', end: true, icon: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z' },
  { to: '/users', label: 'Users', icon: 'M16 11c1.7 0 3-1.3 3-3s-1.3-3-3-3-3 1.3-3 3 1.3 3 3 3zm-8 0c1.7 0 3-1.3 3-3S9.7 5 8 5 5 6.300 5 8s1.300 3 3 3zm0 2c-2.300 0-7 1.200-7 3.500V19h14v-2.500C15 14.200 10.300 13 8 13zm8 0c-.3 0-.600 0-1 .1 1.200.9 2 2 2 3.400V19h6v-2.500c0-2.300-4.700-3.500-7-3.500z' },
  { to: '/datasets', label: 'Datasets', icon: 'M12 3C7 3 3 4.800 3 7v10c0 2.200 4 4 9 4s9-1.800 9-4V7c0-2.200-4-4-9-4zm0 2c4 0 7 1.200 7 2s-3 2-7 2-7-1.200-7-2 3-2 7-2zm0 14c-4 0-7-1.200-7-2v-2.500C6.700 15.500 9.200 16 12 16s5.300-.5 7-1.500V17c0 .8-3 2-7 2z' },
  { to: '/publish-requests', label: 'Publish Requests', icon: 'M19 3H5c-1.100 0-2 .9-2 2v14c0 1.100.9 2 2 2h14c1.100 0 2-.9 2-2V5c0-1.100-.9-2-2-2zm-9 14l-5-5 1.400-1.400L10 14.200l7.600-7.600L19 8l-9 9z' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen lg:flex">
      {/* Mobile top bar */}
      <div className="flex items-center justify-between bg-slate-900 px-4 py-3 text-white lg:hidden">
        <span className="font-semibold">DataHub Admin</span>
        <button className="rounded p-1 hover:bg-slate-800" onClick={() => setOpen((o) => !o)} aria-label="Toggle menu">
          <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      <aside
        className={`${open ? 'block' : 'hidden'} w-full shrink-0 bg-slate-900 text-slate-300 lg:sticky lg:top-0 lg:block lg:h-screen lg:w-64`}
      >
        <div className="hidden items-center gap-2 px-6 py-6 lg:flex">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-600 font-bold text-white">D</span>
          <div>
            <p className="font-semibold leading-tight text-white">DataHub</p>
            <p className="text-xs uppercase tracking-widest text-brand-100">Admin Console</p>
          </div>
        </div>

        <nav className="space-y-1 px-3 py-2">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  isActive ? 'bg-brand-600 text-white' : 'hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d={item.icon} />
              </svg>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-800 p-4 lg:absolute lg:bottom-0 lg:w-64">
          <p className="truncate text-sm font-medium text-white">{user?.name}</p>
          <p className="truncate text-xs text-slate-400">{user?.email}</p>
          <button className="mt-3 w-full rounded-lg border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800" onClick={logout}>
            Sign out
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-4 sm:p-8">
        <Outlet />
      </main>
    </div>
  );
}
