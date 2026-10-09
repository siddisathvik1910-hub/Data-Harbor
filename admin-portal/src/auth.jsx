import { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore the session from the httpOnly cookie on page load.
  useEffect(() => {
    api
      .get('/admin/auth/me')
      .then((res) => setUser(res.data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  // If any later request comes back 401 (expired token) or 403 (suspended), drop back to the login page.
  useEffect(() => {
    const id = api.interceptors.response.use(
      (r) => r,
      (error) => {
        const url = error.config?.url || '';
        const isAuthCall = url.includes('/auth/');
        if (!isAuthCall && error.response?.status === 401) setUser(null);
        return Promise.reject(error);
      }
    );
    return () => api.interceptors.response.eject(id);
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/admin/auth/login', { email, password });
    setUser(res.data.user);
  };

  const logout = async () => {
    await api.post('/admin/auth/logout').catch(() => {});
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}
