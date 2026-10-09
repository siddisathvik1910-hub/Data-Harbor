import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api, errMsg } from '../api';
import { Badge, EmptyState, ErrorState, PageHeader, Pagination, Spinner } from '../components/ui';
import { downloadDataset, formatBytes, formatDate, useDebounced } from '../utils';

export default function Datasets() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [visibility, setVisibility] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const debouncedSearch = useDebounced(search);
  useEffect(() => setPage(1), [debouncedSearch, status, visibility]);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    api
      .get('/admin/datasets', {
        params: { search: debouncedSearch || undefined, status: status || undefined, visibility: visibility || undefined, page },
      })
      .then((r) => setData(r.data))
      .catch((e) => setError(errMsg(e)))
      .finally(() => setLoading(false));
  }, [debouncedSearch, status, visibility, page]);
  useEffect(load, [load]);

  return (
    <>
      <PageHeader title="Datasets" subtitle="Every dataset on the platform, in any status" />

      <div className="card">
        <div className="flex flex-wrap gap-3 border-b border-slate-200 p-4">
          <input className="input max-w-xs" placeholder="Search title or owner..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="input max-w-[11rem]" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
          <select className="input max-w-[11rem]" value={visibility} onChange={(e) => setVisibility(e.target.value)}>
            <option value="">Public + Private</option>
            <option value="PUBLIC">Public</option>
            <option value="PRIVATE">Private</option>
          </select>
        </div>

        {error ? (
          <ErrorState message={error} onRetry={load} />
        ) : loading && !data ? (
          <Spinner />
        ) : data.items.length === 0 ? (
          <EmptyState title="No datasets match" hint="Try changing the filters." />
        ) : (
          <div className={`overflow-x-auto ${loading ? 'opacity-60' : ''}`}>
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th">Title</th>
                  <th className="th">Owner</th>
                  <th className="th">Status</th>
                  <th className="th">Visibility</th>
                  <th className="th">Size</th>
                  <th className="th">Uploaded</th>
                  <th className="th text-right">File</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50">
                    <td className="td max-w-xs font-medium">
                      <p className="truncate">{d.title}</p>
                      <p className="truncate text-xs font-normal text-slate-500">{d.category}</p>
                    </td>
                    <td className="td">
                      <Link to={`/users/${d.owner.id}`} className="text-brand-600 hover:underline">
                        {d.owner.name}
                      </Link>
                      <p className="text-xs text-slate-500">{d.owner.email}</p>
                    </td>
                    <td className="td"><Badge value={d.status} /></td>
                    <td className="td"><Badge value={d.visibility} /></td>
                    <td className="td text-slate-600">{formatBytes(d.fileSize)}</td>
                    <td className="td text-slate-600">{formatDate(d.createdAt)}</td>
                    <td className="td text-right">
                      <button className="btn-secondary" onClick={() => downloadDataset(d).catch((e) => toast.error(errMsg(e)))}>
                        Download
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && !error && <Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} />}
      </div>
    </>
  );
}
