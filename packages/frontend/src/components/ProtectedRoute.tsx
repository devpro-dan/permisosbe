import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function ProtectedRoute({ children, allowedRoles, permission }: { children: React.ReactNode; allowedRoles?: number[]; permission?: string }) {
  const { isAuthenticated, loading, user } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4" />
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.rolId)) {
    return <Navigate to="/dashboard" replace />;
  }

  if (permission && user && !user.permissions?.some((item) => item.seccion === permission && item.can_view)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
