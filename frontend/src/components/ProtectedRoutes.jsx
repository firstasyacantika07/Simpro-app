import { Navigate, useLocation } from 'react-router-dom';

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

export default function ProtectedRoute({ children }) {
    const location = useLocation();

    if (!hasValidSession()) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return children;
}