import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api, errMsg } from '../api';
import { VisibilityBadge } from '../components/DatasetCard';
import { Badge, ErrorState, Modal, Spinner } from '../components/ui';
import { blobErrMsg, downloadDataset, formatBytes, formatDate } from '../utils';

export default function DatasetDetail() {
  const { id } = useParams();
  const [info, setInfo] = useState(null);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [asking, setAsking] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setError('');
    api
      .get(`/datasets/${id}`)
      .then((r) => setInfo(r.data))
      .catch((e) => setError(errMsg(e)));
  }, [id]);

  useEffect(() => {
    setInfo(null);
    load();
  }, [load]);

  async function onDownload() {
    setDownloading(true);
    try {
      await downloadDataset(info.dataset);
      load(); // refresh the download counter
    } catch (e) {
      toast.error(await blobErrMsg(e));
    } finally {
      setDownloading(false);
    }
  }

  async function requestAccess() {
    setBusy(true);
    try {
      await api.post(`/datasets/${id}/access-requests`, { message: message.trim() || undefined });
      toast.success('Access request sent to the publisher');
      setAsking(false);
      setMessage('');
      load();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  if (error) return <ErrorState message={error} />;
  if (!info) return <Spinner />;

  const { dataset: d, canDownload, myRequest, stats } = info;
  const isPrivate = d.visibility === 'PRIVATE';

  return (
    <>
      <Link to="/" className="mb-4 inline-block text-sm text-brand-700 hover:underline">
        &larr; Back to catalog
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        {/* Main */}
        <div className="card p-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">{d.category}</span>
            <VisibilityBadge visibility={d.visibility} />
            {d.isOwner && d.status !== 'APPROVED' && <Badge value={d.status} />}
          </div>
          <h1 className="mt-3 text-2xl font-semibold text-slate-900">{d.title}</h1>
          <p className="mt-1 text-sm text-slate-500">
            Published by {d.isOwner ? 'you' : d.owner.name} on {formatDate(d.createdAt)}
          </p>

          <p className="mt-5 whitespace-pre-line text-slate-700">{d.description}</p>

          {d.tags.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-1.5">
              {d.tags.map((t) => (
                <span key={t} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">#{t}</span>
              ))}
            </div>
          )}

          {d.status === 'REJECTED' && d.rejectionReason && (
            <div className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-800">
              <strong>Rejected:</strong> {d.rejectionReason}
            </div>
          )}

          <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-slate-100 pt-5 text-sm sm:grid-cols-4">
            <div><dt className="text-xs uppercase text-slate-500">File</dt><dd className="mt-0.5 truncate font-medium" title={d.fileName}>{d.fileName}</dd></div>
            <div><dt className="text-xs uppercase text-slate-500">Format</dt><dd className="mt-0.5 font-medium">{d.fileType.toUpperCase()}</dd></div>
            <div><dt className="text-xs uppercase text-slate-500">Size</dt><dd className="mt-0.5 font-medium">{formatBytes(d.fileSize)}</dd></div>
            <div><dt className="text-xs uppercase text-slate-500">Downloads</dt><dd className="mt-0.5 font-medium">{d.downloadCount}</dd></div>
          </dl>
        </div>

        {/* Action panel */}
        <aside className="space-y-4">
          <div className="card space-y-3 p-5">
            {canDownload ? (
              <>
                <button className="btn-primary w-full" onClick={onDownload} disabled={downloading}>
                  {downloading ? 'Preparing download...' : `Download (${formatBytes(d.fileSize)})`}
                </button>
                {isPrivate && !d.isOwner && <p className="text-xs text-emerald-700">Access granted by the publisher.</p>}
              </>
            ) : (
              <>
                <div className="rounded-lg bg-violet-50 p-3 text-sm text-violet-900">
                  This is a <strong>private</strong> dataset. The publisher must approve your request before you can download it.
                </div>

                {!myRequest || myRequest.status === 'REJECTED' ? (
                  <>
                    {myRequest?.status === 'REJECTED' && (
                      <div className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
                        <strong>Your last request was declined.</strong>
                        {myRequest.responseNote && <p className="mt-1">Note: {myRequest.responseNote}</p>}
                      </div>
                    )}
                    <button className="btn-primary w-full" onClick={() => setAsking(true)}>
                      {myRequest ? 'Request access again' : 'Request access'}
                    </button>
                  </>
                ) : (
                  <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                    <strong>Request pending.</strong> You will be notified when the publisher responds.
                  </div>
                )}
                <button className="btn-secondary w-full" disabled title="Locked until access is approved">
                  Download locked
                </button>
              </>
            )}
          </div>

          {d.isOwner && stats && (
            <div className="card p-5">
              <h2 className="font-semibold">Your dataset stats</h2>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-slate-500">Status</dt><dd><Badge value={d.status} /></dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">Downloads</dt><dd className="font-medium">{stats.downloadCount}</dd></div>
                {isPrivate && (
                  <>
                    <div className="flex justify-between"><dt className="text-slate-500">Pending requests</dt><dd className="font-medium">{stats.pendingRequests}</dd></div>
                    <div className="flex justify-between"><dt className="text-slate-500">Approved requests</dt><dd className="font-medium">{stats.approvedRequests}</dd></div>
                    <div className="flex justify-between"><dt className="text-slate-500">Declined requests</dt><dd className="font-medium">{stats.rejectedRequests}</dd></div>
                  </>
                )}
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                {d.status !== 'APPROVED' && <Link to={`/datasets/${d.id}/edit`} className="btn-secondary">Edit</Link>}
                {isPrivate && stats.pendingRequests > 0 && <Link to="/requests/received" className="btn-secondary">Review requests</Link>}
              </div>
            </div>
          )}
        </aside>
      </div>

      {asking && (
        <Modal
          title="Request access"
          onClose={() => setAsking(false)}
          footer={
            <>
              <button className="btn-secondary" onClick={() => setAsking(false)} disabled={busy}>Cancel</button>
              <button className="btn-primary" onClick={requestAccess} disabled={busy}>{busy ? 'Sending...' : 'Send request'}</button>
            </>
          }
        >
          <p className="mb-3">Tell {d.owner.name} why you would like to use "{d.title}". (optional)</p>
          <textarea className="input min-h-[96px]" maxLength={500} placeholder="e.g. I'm working on a research project about..." value={message} onChange={(e) => setMessage(e.target.value)} autoFocus />
          <p className="mt-1 text-right text-xs text-slate-400">{message.length}/500</p>
        </Modal>
      )}
    </>
  );
}
