import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errMsg } from '../api';
import { ErrorState, PageHeader, Spinner } from '../components/ui';

function StatCard({ label, value, tone, to }) {
  const body = (
    <div className="card p-5 transition hover:shadow-md">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className={`mt-2 text-3xl font-semibold ${tone}`}>{value}</p>
    </div>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setError('');
    api
      .get('/admin/stats')
      .then((r) => setStats(r.data))
      .catch((e) => setError(errMsg(e)));
  }, []);
  useEffect(load, [load]);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!stats) return <Spinner />;

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Platform overview" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="Total users" value={stats.totalUsers} tone="text-slate-900" to="/users" />
        <StatCard label="Total datasets" value={stats.totalDatasets} tone="text-slate-900" to="/datasets" />
        <StatCard label="Pending publish requests" value={stats.pending} tone="text-amber-600" to="/publish-requests" />
        <StatCard label="Approved datasets" value={stats.approved} tone="text-emerald-600" />
        <StatCard label="Rejected datasets" value={stats.rejected} tone="text-red-600" />
        <StatCard label="Suspended users" value={stats.suspendedUsers} tone="text-slate-900" />
      </div>

      {stats.pending > 0 && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-sm text-amber-900">
            <strong>{stats.pending}</strong> dataset{stats.pending === 1 ? ' is' : 's are'} waiting for your review.
          </p>
          <Link to="/publish-requests" className="btn-primary">
            Review now
          </Link>
        </div>
      )}
    </>
  );
}
