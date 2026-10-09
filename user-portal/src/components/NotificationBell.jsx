import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { timeAgo } from '../utils';

const DOT = {
  DATASET_APPROVED: 'bg-emerald-500',
  DATASET_REJECTED: 'bg-red-500',
  ACCESS_REQUEST_RECEIVED: 'bg-sky-500',
  ACCESS_REQUEST_APPROVED: 'bg-emerald-500',
  ACCESS_REQUEST_REJECTED: 'bg-amber-500',
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef(null);
  const navigate = useNavigate();

  const load = useCallback(() => {
    api
      .get('/notifications')
      .then((r) => {
        setItems(r.data.items);
        setUnread(r.data.unreadCount);
      })
      .catch(() => {});
  }, []);

  // Poll every 30s so new notifications show up without a page refresh.
  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    const onClick = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  async function openItem(n) {
    setOpen(false);
    if (!n.read) {
      await api.post(`/notifications/${n.id}/read`).catch(() => {});
      load();
    }
    if (n.link) navigate(n.link);
  }

  async function markAll() {
    await api.post('/notifications/read-all').catch(() => {});
    load();
  }

  return (
    <div className="relative" ref={ref}>
      <button
        className="relative rounded-full p-2 text-slate-600 hover:bg-slate-100"
        onClick={() => {
          setOpen((o) => !o);
          if (!open) load();
        }}
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`}
      >
        <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0118 14.200V11a6 6 0 10-12 0v3.200c0 .5-.2 1-.6 1.400L4 17h5m6 0a3 3 0 11-6 0m6 0H9" />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-[1.25rem] place-items-center rounded-full bg-red-500 px-1 text-[11px] font-semibold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl sm:w-96">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="font-semibold">Notifications</p>
            {unread > 0 && (
              <button className="text-xs font-medium text-brand-600 hover:underline" onClick={markAll}>
                Mark all as read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-slate-500">You are all caught up.</p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => openItem(n)}
                  className={`flex w-full gap-3 border-b border-slate-50 px-4 py-3 text-left hover:bg-slate-50 ${n.read ? '' : 'bg-brand-50/60'}`}
                >
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? 'bg-slate-300' : DOT[n.type] || 'bg-slate-400'}`} />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-slate-900">{n.title}</span>
                    <span className="block text-sm text-slate-600">{n.message}</span>
                    <span className="mt-0.5 block text-xs text-slate-400">{timeAgo(n.createdAt)}</span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
