import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api, errMsg } from '../api';
import { Badge, EmptyState, ErrorState, PageHeader, Spinner } from '../components/ui';
import { downloadDataset, formatBytes, formatDate } from '../utils';

export default function UserDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setData(null);
    api
      .get(`/admin/users/${id}`)
      .then((r) => setData(r.data))
      .catch((e) => setError(errMsg(e)));
  }, [id]);

  if (error) return <ErrorState message={error} />;
  if (!data) return <Spinner />;
  const { user, datasets } = data;

  return (
    <>
      <Link to="/users" className="mb-4 inline-block text-sm text-brand-600 hover:underline">
        &larr; Back to users
      </Link>
      <PageHeader title={user.name} subtitle={user.email} actions={<Badge value={user.status} />} />

      <div className="card mb-6 grid gap-4 p-5 sm:grid-cols-3">
        <div>
          <p className="text-xs uppercase text-slate-500">Joined</p>
          <p className="mt-1 font-medium">{formatDate(user.createdAt)}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-slate-500">Datasets uploaded</p>
          <p className="mt-1 font-medium">{user.datasetCount}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-slate-500">Status</p>
          <p className="mt-1 font-medium">{user.status === 'ACTIVE' ? 'Active' : 'Suspended'}</p>
        </div>
      </div>

      <div className="card">
        <h2 className="border-b border-slate-200 px-4 py-3 font-semibold">Datasets by {user.name}</h2>
        {datasets.length === 0 ? (
          <EmptyState title="No datasets yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="th">Title</th>
                  <th className="th">Status</th>
                  <th className="th">Visibility</th>
                  <th className="th">Size</th>
                  <th className="th">Uploaded</th>
                  <th className="th text-right">File</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {datasets.map((d) => (
                  <tr key={d.id}>
                    <td className="td font-medium">
                      {d.title}
                      {d.rejectionReason && <p className="mt-0.5 text-xs font-normal text-red-600">Rejected: {d.rejectionReason}</p>}
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
      </div>
    </>
  );
}
