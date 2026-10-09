import axios from 'axios';

// withCredentials => the browser sends/receives the httpOnly auth cookie.
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api',
  withCredentials: true,
});

/** Turn any axios error into one readable sentence for a toast or form message. */
export function errMsg(err) {
  const data = err?.response?.data;
  if (data?.details && typeof data.details === 'object') {
    const first = Object.values(data.details).flat()[0];
    if (first) return first;
  }
  return data?.error || err?.message || 'Something went wrong';
}
