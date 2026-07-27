import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import Login from './pages/Login';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import MisPermisos from './pages/MisPermisos';
import SolicitarPermiso from './pages/SolicitarPermiso';
import GestionPermisos from './pages/GestionPermisos';
import Usuarios from './pages/Usuarios';
import Roles from './pages/Roles';
import Configuracion from './pages/Configuracion';
import Sesiones from './pages/Sesiones';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/mis-permisos" element={<ProtectedRoute allowedRoles={[3]}><MisPermisos /></ProtectedRoute>} />
            <Route path="/solicitar-permiso" element={<ProtectedRoute allowedRoles={[3]}><SolicitarPermiso /></ProtectedRoute>} />
            <Route path="/gestion-permisos" element={<ProtectedRoute allowedRoles={[1, 2]}><GestionPermisos /></ProtectedRoute>} />
            <Route path="/usuarios" element={<ProtectedRoute allowedRoles={[1]}><Usuarios /></ProtectedRoute>} />
            <Route path="/roles" element={<ProtectedRoute allowedRoles={[1]}><Roles /></ProtectedRoute>} />
            <Route path="/configuracion" element={<ProtectedRoute allowedRoles={[1]}><Configuracion /></ProtectedRoute>} />
            <Route path="/sesiones" element={<ProtectedRoute allowedRoles={[1]}><Sesiones /></ProtectedRoute>} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
