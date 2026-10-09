import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import { Spinner } from './components/ui';
import Layout from './components/Navbar';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Catalog from './pages/Catalog';
import DatasetDetail from './pages/DatasetDetail';
import DatasetForm from './pages/DatasetForm';
import MyDatasets from './pages/MyDatasets';
import RequestsReceived from './pages/RequestsReceived';
import RequestsSent from './pages/RequestsSent';

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  return user ? children : <Navigate to="/login" replace />;
}

function GuestOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  return user ? <Navigate to="/" replace /> : children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
      <Route path="/signup" element={<GuestOnly><Signup /></GuestOnly>} />
      <Route
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route path="/" element={<Catalog />} />
        <Route path="/datasets/:id" element={<DatasetDetail />} />
        <Route path="/datasets/:id/edit" element={<DatasetForm />} />
        <Route path="/publish" element={<DatasetForm />} />
        <Route path="/my-datasets" element={<MyDatasets />} />
        <Route path="/requests/received" element={<RequestsReceived />} />
        <Route path="/requests/sent" element={<RequestsSent />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
