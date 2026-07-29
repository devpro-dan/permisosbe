import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useState } from 'react';
import { LayoutDashboard, ClipboardList, FilePlus, ClipboardCheck, Users, Shield, Settings, History, FileBarChart, UserPlus, ScrollText, Menu, X, LogOut } from 'lucide-react';

const iconMap: Record<string, React.ReactNode> = {
  Dashboard: <LayoutDashboard className="w-4 h-4" />,
  'Mis Permisos': <ClipboardList className="w-4 h-4" />,
  'Solicitar Permiso': <FilePlus className="w-4 h-4" />,
  'Registrar Permiso': <UserPlus className="w-4 h-4" />,
  'Gestionar Permisos': <ClipboardCheck className="w-4 h-4" />,
  Usuarios: <Users className="w-4 h-4" />,
  Roles: <Shield className="w-4 h-4" />,
  Configuración: <Settings className="w-4 h-4" />,
  Sesiones: <History className="w-4 h-4" />,
  Reportes: <FileBarChart className="w-4 h-4" />,
  Auditoría: <ScrollText className="w-4 h-4" />,
};

const navItems = [
  { label: 'Dashboard', path: '/dashboard', roles: [1, 2, 3] },
  { label: 'Mis Permisos', path: '/mis-permisos', roles: [3] },
  { label: 'Solicitar Permiso', path: '/solicitar-permiso', roles: [3] },
  { label: 'Registrar Permiso', path: '/registrar-permiso', roles: [1, 2] },
  { label: 'Gestionar Permisos', path: '/gestion-permisos', roles: [1, 2] },
  { label: 'Reportes', path: '/reportes', roles: [1, 2] },
  { label: 'Usuarios', path: '/usuarios', roles: [1] },
  { label: 'Roles', path: '/roles', roles: [1] },
  { label: 'Configuración', path: '/configuracion', roles: [1] },
  { label: 'Auditoría', path: '/auditoria', roles: [1] },
  { label: 'Sesiones', path: '/sesiones', roles: [1] },
];

export function Sidebar() {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const filtered = navItems.filter((item) => {
    if (!user || !item.roles.includes(user.rolId)) return false;
    if (item.path === '/reportes') {
      return user.permissions?.some((permission) => permission.seccion === 'reportes' && permission.can_view) ?? false;
    }
    return true;
  });

  return (
    <>
      <button
        className="md:hidden fixed top-4 left-4 z-50 p-2 bg-primary-600 text-white rounded-lg shadow-lg"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-primary-800 text-white transform transition-transform duration-200 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 md:static md:inset-auto md:h-screen`}>
        <div className="p-4 border-b border-primary-700">
          <h1 className="text-xl font-bold">PermisosBE</h1>
          <p className="text-sm text-primary-200 mt-1">{user?.nombres} {user?.apellido_paterno}</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {filtered.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition-colors ${isActive ? 'bg-primary-600 text-white' : 'text-primary-100 hover:bg-primary-700 hover:text-white'}`
              }
            >
              {iconMap[item.label]}
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-primary-700">
          <button onClick={logout} className="flex items-center gap-3 w-full px-4 py-2 text-sm text-primary-100 hover:text-white hover:bg-primary-700 rounded-lg transition-colors">
            <LogOut className="w-4 h-4" />
            Cerrar Sesión
          </button>
        </div>
      </aside>
    </>
  );
}
