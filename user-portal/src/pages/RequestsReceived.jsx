import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api, errMsg } from '../api';
import { Badge, EmptyState, ErrorState, Modal, PageHeader, Spinner } from '../components/ui';
import { formatDate } from '../utils';

const TABS = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Declined' },
  { value: '', label: 'All' },
];

export default function RequestsReceived() {
  const [tab, setTab] = useState('PENDING');
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [acting, setActing] = useState(null); // { request, decision: 'approve' | 'reject' }
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setError('');
    api
      .get('/access-requests/received', { params: { status: tab || undefined } })
      .then((r) => setItems(r.data.items))
      .catch((e) => setError(errMsg(e)));
  }, [tab]);

  useEffect(() => {
    setItems(null);
    load();
  }, [load]);

  function close() {
    setActing(null);
    setNote('');
  }

  async function submit() {
    setBusy(true);
    try {
      await api.post(`/access-requests/${acting.request.id}/${acting.decision}`, { note: note.trim() || undefined });
      toast.success(acting.decision === 'approve' ? 'Access granted' : 'Request declined');
      close();
      load();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  const approving = acting?.decision === 'approve';

  return (
    <>
      <PageHeader title="Access requests received" subtitle="People asking to download your private datasets" />

      <div className="mb-4 flex gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.label}
            onClick={() => setTab(t.value)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === t.value ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : !items ? (
        <Spinner />
      ) : items.length === 0 ? (
        <div className="card">
          <EmptyState title="No requests here" hint={tab === 'PENDING' ? 'New access requests for your private datasets will show up here.' : undefined} />
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((r) => (
            <div key={r.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-slate-500">
                    <span className="font-semibold text-slate-900">{r.requester.name}</span> ({r.requester.email}) requested
                    access to
                  </p>
                  <Link to={`/datasets/${r.dataset.id}`} className="text-base font-semibold text-brand-700 hover:underline">
                    {r.dataset.title}
                  </Link>
                  <p className="mt-0.5 text-xs text-slate-400">{formatDate(r.createdAt)}</p>
                </div>
                <Badge value={r.status} />
              </div>

              {r.message ? (
                <blockquote className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">"{r.message}"</blockquote>
              ) : (
                <p className="mt-3 text-sm italic text-slate-400">No message provided.</p>
              )}

              {r.status !== 'PENDING' && r.responseNote && (
                <p className="mt-2 text-sm text-slate-600"><strong>Your note:</strong> {r.responseNote}</p>
              )}

              {r.status === 'PENDING' && (
                <div className="mt-4 flex justify-end gap-2">
                  <button className="btn-danger" onClick={() => setActing({ request: r, decision: 'reject' })}>Decline</button>
                  <button className="btn-success" onClick={() => setActing({ request: r, decision: 'approve' })}>Approve</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {acting && (
        <Modal
          title={approving ? 'Grant access?' : 'Decline request?'}
          onClose={close}
          footer={
            <>
              <button className="btn-secondary" onClick={close} disabled={busy}>Cancel</button>
              <button className={approving ? 'btn-success' : 'btn-danger'} onClick={submit} disabled={busy}>
                {busy ? 'Working...' : approving ? 'Approve' : 'Decline'}
              </button>
            </>
          }
        >
          <p className="mb-3">
            {approving
              ? `${acting.request.requester.name} will be able to download "${acting.request.dataset.title}".`
              : `${acting.request.requester.name} will be told their request was declined.`}
          </p>
          <textarea className="input min-h-[80px]" maxLength={500} placeholder="Add a note (optional)" value={note} onChange={(e) => setNote(e.target.value)} autoFocus />
        </Modal>
      )}
    </>
  );
}
