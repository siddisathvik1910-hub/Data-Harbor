import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api, errMsg } from '../api';
import { VisibilityBadge } from '../components/DatasetCard';
import { Badge, ConfirmDialog, EmptyState, ErrorState, PageHeader, Spinner } from '../components/ui';
import { formatBytes, formatDate } from '../utils';

export default function MyDatasets() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setError('');
    api
      .get('/datasets/mine')
      .then((r) => setItems(r.data.items))
      .catch((e) => setError(errMsg(e)));
  }, []);
  useEffect(load, [load]);

  async function remove() {
    setBusy(true);
    try {
      await api.delete(`/datasets/${deleting.id}`);
      toast.success('Dataset deleted');
      setDeleting(null);
      load();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!items) return <Spinner />;

  return (
    <>
      <PageHeader
        title="My datasets"
        subtitle="Everything you have uploaded and where it stands in review"
        actions={<Link to="/publish" className="btn-primary">+ Publish dataset</Link>}
      />

      {items.length === 0 ? (
        <div className="card">
          <EmptyState title="You have not published anything yet" hint="Upload your first dataset to share it with the community." />
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((d) => (
            <div key={d.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold text-slate-900">{d.title}</h2>
                    <Badge value={d.status} />
                    <VisibilityBadge visibility={d.visibility} />
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {d.category} - {d.fileType.toUpperCase()} - {formatBytes(d.fileSize)} - uploaded {formatDate(d.createdAt)}
                    {d.status === 'APPROVED' && ` - ${d.downloadCount} downloads`}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {d.status === 'APPROVED' && <Link to={`/datasets/${d.id}`} className="btn-secondary">View</Link>}
                  {d.status !== 'APPROVED' && <Link to={`/datasets/${d.id}/edit`} className="btn-secondary">{d.status === 'REJECTED' ? 'Edit & resubmit' : 'Edit'}</Link>}
                  <button className="btn-secondary text-red-600" onClick={() => setDeleting(d)}>Delete</button>
                </div>
              </div>

              {d.status === 'PENDING' && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">Waiting for admin review. It is not visible in the catalog yet.</p>}
              {d.status === 'REJECTED' && (
                <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
                  <strong>Rejected:</strong> {d.rejectionReason}
                </p>
              )}
              {d.status === 'APPROVED' && d.pendingAccessRequests > 0 && (
                <p className="mt-3 text-sm">
                  <Link to="/requests/received" className="font-medium text-brand-700 hover:underline">
                    {d.pendingAccessRequests} pending access request{d.pendingAccessRequests === 1 ? '' : 's'}
                  </Link>
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete this dataset?"
          message={`"${deleting.title}" and its file will be permanently removed, along with any access requests for it. This cannot be undone.`}
          confirmLabel="Delete dataset"
          danger
          busy={busy}
          onConfirm={remove}
          onCancel={() => setDeleting(null)}
        />
      )}
    </>
  );
}
