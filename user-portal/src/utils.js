import { useEffect, useState } from 'react';
import { api } from './api';

export function formatBytes(bytes) {
  if (bytes == null) return '-';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(1)} ${units[i]}`;
}

export const formatDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '-';

export function timeAgo(iso) {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function useDebounced(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

/** Download through the authorization-checked endpoint (cookie sent), then hand the blob to the browser. */
export async function downloadDataset(dataset) {
  const res = await api.get(`/datasets/${dataset.id}/download`, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = dataset.fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Errors from blob requests arrive as a Blob, not JSON. Unwrap the server's message
 * (e.g. "This dataset is private...") so the toast is readable.
 */
export async function blobErrMsg(err) {
  const blob = err?.response?.data;
  if (blob instanceof Blob) {
    try {
      return JSON.parse(await blob.text()).error || 'Download failed';
    } catch {
      return 'Download failed';
    }
  }
  return err?.response?.data?.error || err?.message || 'Download failed';
}
