import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';

function hasValidSession() {
  const token = localStorage.getItem('token');
  const rawUser = localStorage.getItem('user');
  if (!token || !rawUser) return false;

  try {
    const parsedUser = JSON.parse(rawUser);
    return Boolean(parsedUser && typeof parsedUser === 'object');
  } catch {
    return false;
  }
}

function ProtectedRoute({ children }) {
  if (!hasValidSession()) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}