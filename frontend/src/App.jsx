import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import {
  getAccessToken,
  getStoredUser,
  refreshAccessToken,
  clearAuthSession,
} from './api/axiosClient';

function ProtectedRoute({ children }) {
  const [status, setStatus] = useState(() => {
    const token = getAccessToken();
    const user = getStoredUser();
    if (token && user) return 'authenticated';
    if (!user) return 'unauthenticated';
    return 'checking';
  });

  useEffect(() => {
    let active = true;

    async function verifyOrRefresh() {
      const token = getAccessToken();
      const user = getStoredUser();

      if (!user) {
        clearAuthSession();
        if (active) setStatus('unauthenticated');
        return;
      }

      if (token) {
        if (active) setStatus('authenticated');
        return;
      }

      try {
        const refreshed = await refreshAccessToken();
        if (!active) return;

        if (refreshed?.accessToken || refreshed?.user || getStoredUser()) {
          setStatus('authenticated');
        } else {
          setStatus('authenticated');
        }
      } catch {
        if (!active) return;
        // Tetap izinkan masuk jika storedUser tersedia agar tidak langsung terpental ke /login
        if (getStoredUser()) {
          setStatus('authenticated');
        } else {
          clearAuthSession();
          setStatus('unauthenticated');
        }
      }
    }

    if (status === 'checking') {
      verifyOrRefresh();
    }

    return () => {
      active = false;
    };
  }, [status]);

  if (status === 'checking') {
    return (
      <div className="min-h-screen bg-[#070c16] text-slate-300 flex items-center justify-center text-sm">
        Memeriksa sesi autentikasi...
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function App() {
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

export default App;