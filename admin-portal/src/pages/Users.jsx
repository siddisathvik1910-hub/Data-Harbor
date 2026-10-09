import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api, errMsg } from '../api';
import { Badge, ConfirmDialog, EmptyState, ErrorState, PageHeader, Pagination, Spinner } from '../components/ui';
import { formatDate, useDebounced } from '../utils';

export default function Users() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState(null); // user pending suspend/reactivate confirmation
  const [busy, setBusy] = useState(false);

  const debouncedSearch = useDebounced(search);
  useEffect(() => setPage(1), [debouncedSearch, status]);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    api
      .get('/admin/users', { params: { search: debouncedSearch || undefined, status: status || undefined, page } })
      .then((r) => setData(r.data))
      .catch((e) => setError(errMsg(e)))
      .finally(() => setLoading(false));
  }, [debouncedSearch, status, page]);
  useEffect(load, [load]);

  async function toggleStatus() {
    setBusy(true);
    const next = target.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      await api.patch(`/admin/users/${target.id}/status`, { status: next });
      toast.success(next === 'SUSPENDED' ? `${target.name} suspended` : `${target.name} reactivated`);
      setTarget(null);
      load();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  const suspending = target?.status === 'ACTIVE';

  return (
    <>
      <PageHeader title="Users" subtitle="Everyone who has signed up on the user website" />

      <div className="card">
        <div className="flex flex-wrap gap-3 border-b border-slate-200 p-4">
          <input className="input max-w-xs" placeholder="Search name or email..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="input max-w-[11rem]" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
          </select>
        </div>

        {error ? (
          <ErrorState message={error} onRetry={load} />
        ) : loading && !data ? (
          <Spinner />
        ) : data.items.length === 0 ? (
          <EmptyState title="No users found" hint="Try a different search or filter." />
        ) : (
          <div className={`overflow-x-auto ${loading ? 'opacity-60' : ''}`}>
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th">Name</th>
                  <th className="th">Email</th>
                  <th className="th">Joined</th>
                  <th className="th">Datasets</th>
                  <th className="th">Status</th>
                  <th className="th text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="td font-medium">
                      <Link to={`/users/${u.id}`} className="text-brand-600 hover:underline">
                        {u.name}
                      </Link>
                    </td>
                    <td className="td text-slate-600">{u.email}</td>
                    <td className="td text-slate-600">{formatDate(u.createdAt)}</td>
                    <td className="td">{u.datasetCount}</td>
                    <td className="td">
                      <Badge value={u.status} />
                    </td>
                    <td className="td text-right">
                      <button className={u.status === 'ACTIVE' ? 'btn-secondary text-red-600' : 'btn-secondary text-emerald-700'} onClick={() => setTarget(u)}>
                        {u.status === 'ACTIVE' ? 'Suspend' : 'Reactivate'}
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

      {target && (
        <ConfirmDialog
          title={suspending ? 'Suspend this user?' : 'Reactivate this user?'}
          message={
            suspending
              ? `${target.name} will be signed out and unable to log in or perform any action until reactivated.`
              : `${target.name} will be able to log in and use the platform again.`
          }
          confirmLabel={suspending ? 'Suspend user' : 'Reactivate'}
          danger={suspending}
          busy={busy}
          onConfirm={toggleStatus}
          onCancel={() => setTarget(null)}
        />
      )}
    </>
  );
}
