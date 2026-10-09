import { Link } from 'react-router-dom';
import { formatBytes, formatDate } from '../utils';

export function VisibilityBadge({ visibility }) {
  const isPrivate = visibility === 'PRIVATE';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        isPrivate ? 'bg-violet-100 text-violet-800' : 'bg-sky-100 text-sky-800'
      }`}
    >
      {isPrivate ? (
        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18 8h-1V6a5 5 0 00-10 0v2H6a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V10a2 2 0 00-2-2zm-6 9a2 2 0 110-4 2 2 0 010 4zm3.100-9H8.900V6a3.100 3.100 0 016.200 0v2z" />
        </svg>
      ) : null}
      {isPrivate ? 'Private' : 'Public'}
    </span>
  );
}

export default function DatasetCard({ dataset }) {
  return (
    <Link
      to={`/datasets/${dataset.id}`}
      className="card flex flex-col p-5 transition hover:-translate-y-0.5 hover:border-brand-500 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="rounded bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">{dataset.category}</span>
        <VisibilityBadge visibility={dataset.visibility} />
      </div>
      <h3 className="mt-3 line-clamp-2 text-base font-semibold text-slate-900">{dataset.title}</h3>
      <p className="mt-1 line-clamp-3 flex-1 text-sm text-slate-600">{dataset.description}</p>

      {dataset.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {dataset.tags.slice(0, 4).map((t) => (
            <span key={t} className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
              #{t}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
        <span className="truncate">
          {dataset.isOwner ? 'You' : dataset.owner.name} - {formatDate(dataset.createdAt)}
        </span>
        <span className="shrink-0">
          {dataset.fileType.toUpperCase()} - {formatBytes(dataset.fileSize)} - {dataset.downloadCount} downloads
        </span>
      </div>
    </Link>
  );
}
