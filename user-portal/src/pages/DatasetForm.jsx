import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api, errMsg } from '../api';
import { ErrorState, PageHeader, Spinner } from '../components/ui';
import { formatBytes } from '../utils';

// Keep in sync with the backend (MAX_FILE_MB and allowedExtensions); the backend enforces them regardless.
const MAX_MB = 50;
const ALLOWED = ['csv', 'json', 'xlsx', 'zip', 'txt'];

const EMPTY = { title: '', description: '', category: '', tags: '', visibility: 'PUBLIC' };

function validate(form, file, isEdit) {
  const errs = {};
  if (form.title.trim().length < 3) errs.title = 'Title must be at least 3 characters.';
  if (form.description.trim().length < 10) errs.description = 'Description must be at least 10 characters.';
  if (form.category.trim().length < 2) errs.category = 'Category is required.';
  const tags = form.tags.split(',').map((t) => t.trim()).filter(Boolean);
  if (tags.length > 10) errs.tags = 'Use at most 10 tags.';
  if (tags.some((t) => t.length > 30)) errs.tags = 'Each tag must be 30 characters or fewer.';
  if (!isEdit) {
    if (!file) errs.file = 'Please choose a file to upload.';
    else {
      const ext = file.name.split('.').pop().toLowerCase();
      if (!ALLOWED.includes(ext)) errs.file = `File type .${ext} is not allowed. Allowed: ${ALLOWED.join(', ')}.`;
      else if (file.size > MAX_MB * 1024 * 1024) errs.file = `File is too large (max ${MAX_MB} MB).`;
    }
  }
  return errs;
}

function Field({ label, error, hint, children }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export default function DatasetForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const fileInput = useRef(null);

  const [form, setForm] = useState(EMPTY);
  const [file, setFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState('');
  const [existing, setExisting] = useState(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isEdit) return;
    api
      .get(`/datasets/${id}`)
      .then((r) => {
        const d = r.data.dataset;
        if (!d.isOwner) throw new Error('You can only edit your own datasets');
        if (d.status === 'APPROVED') throw new Error('Approved datasets can no longer be edited');
        setExisting(d);
        setForm({ title: d.title, description: d.description, category: d.category, tags: d.tags.join(', '), visibility: d.visibility });
      })
      .catch((e) => setLoadError(errMsg(e)))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setErrors((er) => ({ ...er, [k]: undefined }));
  };

  async function onSubmit(e) {
    e.preventDefault();
    const errs = validate(form, file, isEdit);
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setBusy(true);
    setProgress(0);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category.trim(),
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
        visibility: form.visibility,
      };
      if (isEdit) {
        await api.put(`/datasets/${id}`, payload);
        toast.success(existing.status === 'REJECTED' ? 'Changes saved and resubmitted for review' : 'Changes saved');
      } else {
        const body = new FormData();
        Object.entries(payload).forEach(([k, v]) => body.append(k, Array.isArray(v) ? JSON.stringify(v) : v));
        body.append('file', file);
        await api.post('/datasets', body, {
          onUploadProgress: (ev) => ev.total && setProgress(Math.round((ev.loaded / ev.total) * 100)),
        });
        toast.success('Submitted! An admin will review your dataset before it appears in the catalog.');
      }
      navigate('/my-datasets');
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Spinner />;
  if (loadError) return <ErrorState message={loadError} />;

  return (
    <>
      <Link to="/my-datasets" className="mb-4 inline-block text-sm text-brand-700 hover:underline">&larr; Back to my datasets</Link>
      <PageHeader
        title={isEdit ? 'Edit dataset' : 'Publish a dataset'}
        subtitle={
          isEdit
            ? existing.status === 'REJECTED'
              ? 'Saving will resubmit this dataset to the admin for review.'
              : 'Update the details of your pending dataset.'
            : 'Your dataset will be reviewed by an admin before it appears in the catalog.'
        }
      />

      {existing?.status === 'REJECTED' && existing.rejectionReason && (
        <div className="mb-4 max-w-2xl rounded-lg bg-red-50 p-3 text-sm text-red-800">
          <strong>Rejection reason:</strong> {existing.rejectionReason}
        </div>
      )}

      <form onSubmit={onSubmit} className="card max-w-2xl space-y-5 p-6" noValidate>
        <Field label="Title" error={errors.title}>
          <input className="input" value={form.title} onChange={set('title')} maxLength={120} placeholder="e.g. City air quality readings 2024" />
        </Field>

        <Field label="Description" error={errors.description}>
          <textarea className="input min-h-[120px]" value={form.description} onChange={set('description')} maxLength={2000} placeholder="What is in this dataset? How was it collected? What columns does it have?" />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Category" error={errors.category}>
            <input className="input" value={form.category} onChange={set('category')} maxLength={50} placeholder="e.g. Climate, Finance, Health" />
          </Field>
          <Field label="Tags" error={errors.tags} hint="Comma separated, up to 10">
            <input className="input" value={form.tags} onChange={set('tags')} placeholder="air, pollution, sensors" />
          </Field>
        </div>

        <Field label="Visibility">
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { v: 'PUBLIC', title: 'Public', text: 'Any signed-in user can download it right away.' },
              { v: 'PRIVATE', title: 'Private', text: 'Listed in the catalog but locked. Users must request your permission.' },
            ].map((o) => (
              <label key={o.v} className={`cursor-pointer rounded-lg border p-3 text-sm transition ${form.visibility === o.v ? 'border-brand-600 bg-brand-50' : 'border-slate-300 hover:bg-slate-50'}`}>
                <input type="radio" name="visibility" className="mr-2 accent-emerald-600" checked={form.visibility === o.v} onChange={() => setForm((f) => ({ ...f, visibility: o.v }))} />
                <span className="font-medium">{o.title}</span>
                <span className="mt-1 block text-slate-600">{o.text}</span>
              </label>
            ))}
          </div>
        </Field>

        {isEdit ? (
          <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
            File: <strong>{existing.fileName}</strong> ({formatBytes(existing.fileSize)}). The file itself cannot be replaced - delete and re-upload if you need a different one.
          </div>
        ) : (
          <Field label="Dataset file" error={errors.file} hint={`Allowed: ${ALLOWED.join(', ')} - max ${MAX_MB} MB`}>
            <input
              ref={fileInput}
              type="file"
              accept={ALLOWED.map((x) => `.${x}`).join(',')}
              className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100"
              onChange={(e) => {
                setFile(e.target.files[0] || null);
                setErrors((er) => ({ ...er, file: undefined }));
              }}
            />
            {file && <p className="mt-1 text-xs text-slate-500">{file.name} - {formatBytes(file.size)}</p>}
          </Field>
        )}

        {busy && !isEdit && (
          <div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full bg-brand-600 transition-all" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-1 text-xs text-slate-500">Uploading... {progress}%</p>
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Link to="/my-datasets" className="btn-secondary">Cancel</Link>
          <button className="btn-primary" disabled={busy}>
            {busy ? 'Saving...' : isEdit ? 'Save changes' : 'Submit for review'}
          </button>
        </div>
      </form>
    </>
  );
}
