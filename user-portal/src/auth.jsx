import { createContext, useContext, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from './api';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/auth/me')
      .then((res) => setUser(res.data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  // Expired session (401) or a suspension that happens mid-session (403 "suspended") => back to login.
  useEffect(() => {
    const id = api.interceptors.response.use(
      (r) => r,
      (error) => {
        const url = error.config?.url || '';
        const status = error.response?.status;
        const data = error.response?.data;
        const message = data && !(data instanceof Blob) ? data.error || '' : '';
        if (!url.includes('/auth/')) {
          if (status === 401) setUser(null);
          if (status === 403 && /suspended/i.test(message)) {
            setUser(null);
            toast.error('Your account has been suspended.');
          }
        }
        return Promise.reject(error);
      }
    );
    return () => api.interceptors.response.eject(id);
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    setUser(res.data.user);
  };

  const signup = async (name, email, password) => {
    const res = await api.post('/auth/signup', { name, email, password });
    setUser(res.data.user);
  };

  const logout = async () => {
    await api.post('/auth/logout').catch(() => {});
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, loading, login, signup, logout }}>{children}</AuthContext.Provider>;
}
