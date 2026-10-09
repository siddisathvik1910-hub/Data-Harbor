import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api, errMsg } from '../api';
import { Badge, ConfirmDialog, EmptyState, ErrorState, Modal, PageHeader, Spinner } from '../components/ui';
import { downloadDataset, formatBytes, formatDate } from '../utils';

export default function PublishRequests() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [approving, setApproving] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setError('');
    api
      .get('/admin/publish-requests')
      .then((r) => setItems(r.data.items))
      .catch((e) => setError(errMsg(e)));
  }, []);
  useEffect(load, [load]);

  async function approve() {
    setBusy(true);
    try {
      await api.post(`/admin/datasets/${approving.id}/approve`);
      toast.success(`"${approving.title}" approved and published`);
      setApproving(null);
      load();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    if (reason.trim().length < 3) {
      setReasonError('Please enter a reason (at least 3 characters). The publisher will see it.');
      return;
    }
    setBusy(true);
    try {
      await api.post(`/admin/datasets/${rejecting.id}/reject`, { reason: reason.trim() });
      toast.success(`"${rejecting.title}" rejected`);
      closeReject();
      load();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  function closeReject() {
    setRejecting(null);
    setReason('');
    setReasonError('');
  }

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!items) return <Spinner />;

  return (
    <>
      <PageHeader title="Publish Requests" subtitle="Review pending datasets. Download the file to inspect it before deciding." />

      {items.length === 0 ? (
        <div className="card">
          <EmptyState title="All caught up" hint="There are no datasets waiting for review." />
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((d) => (
            <div key={d.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold text-slate-900">{d.title}</h2>
                  <p className="mt-0.5 text-sm text-slate-500">
                    by{' '}
                    <Link to={`/users/${d.owner.id}`} className="text-brand-600 hover:underline">
                      {d.owner.name}
                    </Link>{' '}
                    ({d.owner.email}) - submitted {formatDate(d.createdAt)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Badge value={d.visibility} />
                  <Badge value={d.status} />
                </div>
              </div>

              <p className="mt-3 whitespace-pre-line text-sm text-slate-700">{d.description}</p>

              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-4">
                <div>
                  <dt className="text-xs uppercase text-slate-500">Category</dt>
                  <dd className="mt-0.5 font-medium">{d.category}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-slate-500">File</dt>
                  <dd className="mt-0.5 truncate font-medium" title={d.fileName}>{d.fileName}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-slate-500">Type / size</dt>
                  <dd className="mt-0.5 font-medium">{d.fileType.toUpperCase()} - {formatBytes(d.fileSize)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-slate-500">Tags</dt>
                  <dd className="mt-0.5 flex flex-wrap gap-1">
                    {d.tags.length ? d.tags.map((t) => <span key={t} className="rounded bg-slate-100 px-2 py-0.5 text-xs">{t}</span>) : '-'}
                  </dd>
                </div>
              </dl>

              <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
                <button className="btn-secondary" onClick={() => downloadDataset(d).catch((e) => toast.error(errMsg(e)))}>
                  Download to inspect
                </button>
                <button className="btn-danger" onClick={() => setRejecting(d)}>Reject</button>
                <button className="btn-success" onClick={() => setApproving(d)}>Approve</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {approving && (
        <ConfirmDialog
          title="Approve this dataset?"
          message={`"${approving.title}" will appear in the catalog on the user website as ${approving.visibility.toLowerCase()}.`}
          confirmLabel="Approve & publish"
          busy={busy}
          onConfirm={approve}
          onCancel={() => setApproving(null)}
        />
      )}

      {rejecting && (
        <Modal
          title="Reject this dataset"
          onClose={closeReject}
          footer={
            <>
              <button className="btn-secondary" onClick={closeReject} disabled={busy}>Cancel</button>
              <button className="btn-danger" onClick={reject} disabled={busy}>{busy ? 'Working...' : 'Reject dataset'}</button>
            </>
          }
        >
          <p className="mb-3">Tell the publisher why "{rejecting.title}" was rejected. They can edit and resubmit.</p>
          <textarea
            className="input min-h-[96px]"
            placeholder="Reason for rejection (required)"
            value={reason}
            maxLength={500}
            onChange={(e) => {
              setReason(e.target.value);
              setReasonError('');
            }}
            autoFocus
          />
          {reasonError && <p className="mt-1 text-xs text-red-600">{reasonError}</p>}
        </Modal>
      )}
    </>
  );
}
