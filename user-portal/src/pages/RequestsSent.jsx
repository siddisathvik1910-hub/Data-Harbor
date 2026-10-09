import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errMsg } from '../api';
import { Badge, EmptyState, ErrorState, PageHeader, Spinner } from '../components/ui';
import { formatDate } from '../utils';

export default function RequestsSent() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setError('');
    api
      .get('/access-requests/sent')
      .then((r) => setItems(r.data.items))
      .catch((e) => setError(errMsg(e)));
  }, []);
  useEffect(load, [load]);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!items) return <Spinner />;

  return (
    <>
      <PageHeader title="My requests" subtitle="The status of every access request you have sent" />

      {items.length === 0 ? (
        <div className="card">
          <EmptyState title="You have not requested access to anything" hint="Private datasets in the catalog show a Request Access button." />
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((r) => (
            <div key={r.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link to={`/datasets/${r.dataset.id}`} className="text-base font-semibold text-brand-700 hover:underline">
                    {r.dataset.title}
                  </Link>
                  <p className="mt-0.5 text-sm text-slate-500">
                    Publisher: {r.dataset.owner.name} - requested {formatDate(r.createdAt)}
                    {r.respondedAt && ` - answered ${formatDate(r.respondedAt)}`}
                  </p>
                </div>
                <Badge value={r.status} />
              </div>

              {r.message && <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">Your message: "{r.message}"</p>}
              {r.responseNote && <p className="mt-2 text-sm text-slate-700"><strong>Publisher's note:</strong> {r.responseNote}</p>}

              {r.status === 'APPROVED' && (
                <div className="mt-3">
                  <Link to={`/datasets/${r.dataset.id}`} className="btn-primary">Go to download</Link>
                </div>
              )}
              {r.status === 'PENDING' && <p className="mt-3 text-sm text-amber-700">Waiting for the publisher to respond.</p>}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
