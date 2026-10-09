import { useCallback, useEffect, useState } from 'react';
import { api, errMsg } from '../api';
import DatasetCard from '../components/DatasetCard';
import { EmptyState, ErrorState, PageHeader, Pagination, Spinner } from '../components/ui';
import { useDebounced } from '../utils';

export default function Catalog() {
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [tag, setTag] = useState('');
  const [visibility, setVisibility] = useState('');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);

  const [filters, setFilters] = useState({ categories: [], tags: [] });
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const debouncedQ = useDebounced(q);
  useEffect(() => setPage(1), [debouncedQ, category, tag, visibility, sort]);

  useEffect(() => {
    api.get('/datasets/filters').then((r) => setFilters(r.data)).catch(() => {});
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    api
      .get('/datasets', {
        params: {
          q: debouncedQ || undefined,
          category: category || undefined,
          tag: tag || undefined,
          visibility: visibility || undefined,
          sort,
          page,
          limit: 12,
        },
      })
      .then((r) => setData(r.data))
      .catch((e) => setError(errMsg(e)))
      .finally(() => setLoading(false));
  }, [debouncedQ, category, tag, visibility, sort, page]);
  useEffect(load, [load]);

  const hasFilters = q || category || tag || visibility;
  const clear = () => {
    setQ('');
    setCategory('');
    setTag('');
    setVisibility('');
  };

  return (
    <>
      <PageHeader title="Dataset catalog" subtitle="Browse approved datasets shared by the community" />

      <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
        {/* Filters */}
        <aside className="card h-fit space-y-5 p-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Search</label>
            <input className="input" placeholder="Title, description, tag..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Category</label>
            <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">All categories</option>
              {filters.categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Access</label>
            <select className="input" value={visibility} onChange={(e) => setVisibility(e.target.value)}>
              <option value="">Public + Private</option>
              <option value="PUBLIC">Public only</option>
              <option value="PRIVATE">Private only</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">Popular tags</label>
            <div className="flex flex-wrap gap-1.5">
              {filters.tags.length === 0 && <span className="text-xs text-slate-400">No tags yet</span>}
              {filters.tags.map((t) => (
                <button
                  key={t}
                  onClick={() => setTag(tag === t ? '' : t)}
                  className={`rounded-full px-2.5 py-1 text-xs transition ${
                    tag === t ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  #{t}
                </button>
              ))}
            </div>
          </div>
          {hasFilters && (
            <button className="btn-secondary w-full" onClick={clear}>
              Clear filters
            </button>
          )}
        </aside>

        {/* Results */}
        <section>
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-sm text-slate-500">{data ? `${data.total} dataset${data.total === 1 ? '' : 's'}` : ''}</p>
            <select className="input max-w-[12rem]" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort">
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="popular">Most downloaded</option>
              <option value="title">Title (A-Z)</option>
            </select>
          </div>

          {error ? (
            <ErrorState message={error} onRetry={load} />
          ) : loading && !data ? (
            <Spinner />
          ) : data.items.length === 0 ? (
            <div className="card">
              <EmptyState
                title={hasFilters ? 'No datasets match your filters' : 'No datasets published yet'}
                hint={hasFilters ? 'Try removing a filter or searching for something else.' : 'Be the first - publish a dataset!'}
              />
            </div>
          ) : (
            <>
              <div className={`grid gap-4 sm:grid-cols-2 xl:grid-cols-3 ${loading ? 'opacity-60' : ''}`}>
                {data.items.map((d) => (
                  <DatasetCard key={d.id} dataset={d} />
                ))}
              </div>
              <div className="card mt-6">
                <Pagination page={data.page} pages={data.pages} total={data.total} onChange={setPage} />
              </div>
            </>
          )}
        </section>
      </div>
    </>
  );
}
