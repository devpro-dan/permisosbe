import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { subscribePending } from './services/api';
import { Loader2 } from 'lucide-react';
import Login from './pages/Login';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import MisPermisos from './pages/MisPermisos';
import SolicitarPermiso from './pages/SolicitarPermiso';
import RegistrarPermiso from './pages/RegistrarPermiso';
import GestionPermisos from './pages/GestionPermisos';
import Usuarios from './pages/Usuarios';
import Roles from './pages/Roles';
import Configuracion from './pages/Configuracion';
import Sesiones from './pages/Sesiones';
import NotFound from './pages/NotFound';
import Reportes from './pages/Reportes';
import AuditLog from './pages/AuditLog';
import Feriados from './pages/Feriados';

function GlobalProcessingModal() {
  const [pending, setPending] = useState(0);
  const [show, setShow] = useState(false);
  useEffect(() => subscribePending(setPending), []);
  useEffect(() => {
    let t: any;
    if (pending > 0) setShow(true);
    else t = setTimeout(() => setShow(false), 500);
    return () => clearTimeout(t);
  }, [pending]);
  if (!show) return null;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[9999]">
      <div className="bg-white rounded-lg px-8 py-6 flex flex-col items-center gap-3 shadow-xl">
        <Loader2 className="w-10 h-10 animate-spin text-primary-600" />
        <p className="text-sm font-medium text-gray-700">Procesando...</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <GlobalProcessingModal />
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/mis-permisos" element={<ProtectedRoute allowedRoles={[3]}><MisPermisos /></ProtectedRoute>} />
            <Route path="/solicitar-permiso" element={<ProtectedRoute allowedRoles={[3]}><SolicitarPermiso /></ProtectedRoute>} />
            <Route path="/registrar-permiso" element={<ProtectedRoute allowedRoles={[1, 2]}><RegistrarPermiso /></ProtectedRoute>} />
            <Route path="/gestion-permisos" element={<ProtectedRoute allowedRoles={[1, 2]}><GestionPermisos /></ProtectedRoute>} />
            <Route path="/reportes" element={<ProtectedRoute permission="reportes"><Reportes /></ProtectedRoute>} />
            <Route path="/usuarios" element={<ProtectedRoute allowedRoles={[1]}><Usuarios /></ProtectedRoute>} />
            <Route path="/roles" element={<ProtectedRoute allowedRoles={[1]}><Roles /></ProtectedRoute>} />
            <Route path="/configuracion" element={<ProtectedRoute allowedRoles={[1]}><Configuracion /></ProtectedRoute>} />
            <Route path="/sesiones" element={<ProtectedRoute allowedRoles={[1]}><Sesiones /></ProtectedRoute>} />
            <Route path="/auditoria" element={<ProtectedRoute permission="audit_log"><AuditLog /></ProtectedRoute>} />
            <Route path="/feriados" element={<ProtectedRoute permission="feriados"><Feriados /></ProtectedRoute>} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
