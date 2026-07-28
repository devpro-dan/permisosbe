import { useState, useEffect } from 'react';
import { userApi, roleApi } from '../services/api';
import { User, Role } from '../types';
import { DataTable } from '../components/DataTable';
import { MobileCard } from '../components/MobileCard';
import { Modal } from '../components/Modal';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { toast } from '../components/Toast';
import { UserPlus, Save, Key, Shield, ShieldOff } from 'lucide-react';

export default function Usuarios() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
    const [form, setForm] = useState({
    nombres: '', rut: '', dv: '', apellido_paterno: '', apellido_materno: '',
    titulo: '', cargo: '', email: '', username: '', password: '', rol_id: 0,
    can_change_password: true,
  });

  const [passwordModal, setPasswordModal] = useState<{ user: User | null; open: boolean }>({ user: null, open: false });
  const [newPassword, setNewPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const [twoFAModal, setTwoFAModal] = useState<{ user: User | null; open: boolean; enabled: boolean }>({ user: null, open: false, enabled: false });
  const [twoFASecret, setTwoFASecret] = useState('');
  const [twoFAQr, setTwoFAQr] = useState('');
  const [saving2FA, setSaving2FA] = useState(false);

  const load = async () => {
    try {
      const [uRes, rRes] = await Promise.all([userApi.list(), roleApi.list()]);
      setUsers(uRes.data);
      setRoles(rRes.data);
    } catch {
      toast({ message: 'Error al cargar usuarios', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditUser(null);
    setForm({ nombres: '', rut: '', dv: '', apellido_paterno: '', apellido_materno: '', titulo: '', cargo: '', email: '', username: '', password: '', rol_id: roles[0]?.id || 0, can_change_password: true });
    setModalOpen(true);
  };

  const openEdit = (user: User) => {
    setEditUser(user);
    setForm({
      nombres: user.nombres, rut: user.rut, dv: user.dv,
      apellido_paterno: user.apellido_paterno, apellido_materno: user.apellido_materno || '',
      titulo: user.titulo || '', cargo: user.cargo, email: user.email,
      username: user.username, password: '', rol_id: user.rol_id,
      can_change_password: user.can_change_password ?? true,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editUser) {
        await userApi.update(editUser.id, form);
        toast({ message: 'Usuario actualizado correctamente', type: 'success' });
      } else {
        await userApi.create(form);
        toast({ message: 'Usuario creado correctamente', type: 'success' });
      }
      setModalOpen(false);
      load();
    } catch (err: any) {
      toast({ message: err.response?.data?.message || 'Error al guardar usuario', type: 'error' });
    }
  };

  const handleSuspend = async (id: number, suspended: boolean) => {
    if (!confirm(suspended ? '¿Suspender a este usuario?' : '¿Reactivar a este usuario?')) return;
    try {
      await userApi.suspend(id, suspended);
      toast({ message: suspended ? 'Usuario suspendido' : 'Usuario activado', type: 'success' });
      load();
    } catch (err: any) {
      toast({ message: err.response?.data?.message || 'Error al cambiar estado', type: 'error' });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar este usuario?')) return;
    try {
      await userApi.delete(id);
      toast({ message: 'Usuario eliminado', type: 'success' });
      load();
    } catch (err: any) {
      toast({ message: err.response?.data?.message || 'Error al eliminar', type: 'error' });
    }
  };

  const openPasswordModal = (user: User) => {
    setNewPassword('');
    setPasswordModal({ user, open: true });
  };

  const handleChangePassword = async () => {
    if (!passwordModal.user) return;
    if (newPassword.length < 6) {
      toast({ message: 'La contraseña debe tener al menos 6 caracteres', type: 'error' });
      return;
    }
    setSavingPassword(true);
    try {
      await userApi.changePassword(passwordModal.user.id, newPassword);
      toast({ message: 'Contraseña actualizada correctamente', type: 'success' });
      setPasswordModal({ user: null, open: false });
    } catch (err: any) {
      toast({ message: err.response?.data?.message || 'Error al cambiar contraseña', type: 'error' });
    } finally {
      setSavingPassword(false);
    }
  };

  const openTwoFAModal = async (user: User) => {
    setTwoFAModal({ user, open: true, enabled: false });
    setTwoFASecret('');
    setTwoFAQr('');
    try {
      const res = await userApi.get2FAStatus(user.id);
      setTwoFAModal({ user, open: true, enabled: res.data.enabled });
    } catch {
      toast({ message: 'Error al obtener estado 2FA', type: 'error' });
    }
  };

  const handleSetup2FA = async () => {
    if (!twoFAModal.user) return;
    setSaving2FA(true);
    try {
      const res = await userApi.setup2FA(twoFAModal.user.id);
      setTwoFASecret(res.data.secret);
      setTwoFAQr(res.data.qrCodeUrl);
      toast({ message: '2FA configurado. El usuario debe escanear el código.', type: 'success' });
    } catch (err: any) {
      toast({ message: err.response?.data?.message || 'Error al configurar 2FA', type: 'error' });
    } finally {
      setSaving2FA(false);
    }
  };

  const handleDisable2FA = async () => {
    if (!twoFAModal.user) return;
    if (!confirm('¿Desactivar 2FA para este usuario?')) return;
    try {
      await userApi.disable2FA(twoFAModal.user.id);
      toast({ message: '2FA desactivado correctamente', type: 'success' });
      setTwoFAModal({ user: null, open: false, enabled: false });
    } catch (err: any) {
      toast({ message: err.response?.data?.message || 'Error al desactivar 2FA', type: 'error' });
    }
  };

  if (loading) return <LoadingSpinner />;

  const columns = [
    { key: 'nombres', label: 'Nombre', render: (_: any, row: User) => `${row.nombres} ${row.apellido_paterno}` },
    { key: 'rut', label: 'RUT', render: (_: any, row: User) => `${row.rut}-${row.dv}` },
    { key: 'email', label: 'Email' },
    { key: 'cargo', label: 'Cargo' },
    { key: 'rol_nombre', label: 'Rol' },
    { key: 'can_change_password', label: 'Cambio Password', render: (v: boolean) => v ? <span className="text-green-600 font-medium">Sí</span> : <span className="text-gray-400 font-medium">No</span> },
    { key: 'is_suspended', label: 'Estado', render: (v: boolean) => v ? <span className="text-red-600 font-medium">Suspendido</span> : <span className="text-green-600 font-medium">Activo</span> },
    {
      key: 'acciones', label: 'Acciones', render: (_: any, user: User) => (
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => openEdit(user)} className="text-blue-600 hover:text-blue-800 text-sm">Editar</button>
          <button onClick={() => openPasswordModal(user)} className="inline-flex items-center gap-1 text-amber-600 hover:text-amber-800 text-sm"><Key className="w-3.5 h-3.5" /> Password</button>
          <button onClick={() => openTwoFAModal(user)} className="inline-flex items-center gap-1 text-purple-600 hover:text-purple-800 text-sm"><Shield className="w-3.5 h-3.5" /> 2FA</button>
          {!user.is_suspended ? (
            <button onClick={() => handleSuspend(user.id, true)} className="text-orange-600 hover:text-orange-800 text-sm">Suspender</button>
          ) : (
            <button onClick={() => handleSuspend(user.id, false)} className="text-green-600 hover:text-success-800 text-sm">Reactivar</button>
          )}
          <button onClick={() => handleDelete(user.id)} className="text-red-600 hover:text-danger-800 text-sm">Eliminar</button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Usuarios</h1>
        <button onClick={openCreate} className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700">
          <UserPlus className="w-4 h-4" /> Nuevo Usuario
        </button>
      </div>

      <DataTable columns={columns} data={users} />

      {users.map((u) => (
        <MobileCard key={u.id}>
          <p className="font-medium">{u.nombres} {u.apellido_paterno}</p>
          <p className="text-sm text-gray-500">{u.rut}-{u.dv}</p>
          <p className="text-sm">{u.email}</p>
          <p className="text-sm text-gray-600">{u.cargo} - {u.rol_nombre}</p>
          {u.is_suspended && <span className="text-xs text-red-600 font-medium">Suspendido</span>}
          <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t">
            <button onClick={() => openEdit(u)} className="text-blue-600 text-sm font-medium">Editar</button>
            <button onClick={() => openPasswordModal(u)} className="inline-flex items-center gap-1 text-amber-600 text-sm font-medium">
              <Key className="w-3.5 h-3.5" /> Password
            </button>
            <button onClick={() => openTwoFAModal(u)} className="inline-flex items-center gap-1 text-purple-600 text-sm font-medium">
              <Shield className="w-3.5 h-3.5" /> 2FA
            </button>
            {!u.is_suspended ? (
              <button onClick={() => handleSuspend(u.id, true)} className="text-orange-600 text-sm font-medium">Suspender</button>
            ) : (
              <button onClick={() => handleSuspend(u.id, false)} className="text-green-600 text-sm font-medium">Reactivar</button>
            )}
            <button onClick={() => handleDelete(u.id)} className="text-red-600 text-sm font-medium">Eliminar</button>
          </div>
        </MobileCard>
      ))}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editUser ? 'Editar Usuario' : 'Nuevo Usuario'}>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700">Nombres</label>
              <input value={form.nombres} onChange={(e) => setForm({ ...form, nombres: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">Ap. Paterno</label>
              <input value={form.apellido_paterno} onChange={(e) => setForm({ ...form, apellido_paterno: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">Ap. Materno</label>
              <input value={form.apellido_materno} onChange={(e) => setForm({ ...form, apellido_materno: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-700">RUT</label>
                <input value={form.rut} onChange={(e) => setForm({ ...form, rut: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" required />
              </div>
              <div className="w-16">
                <label className="block text-xs font-medium text-gray-700">DV</label>
                <input value={form.dv} onChange={(e) => setForm({ ...form, dv: e.target.value })} maxLength={1} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" required />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">Cargo</label>
              <input value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">Título</label>
              <input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">Rol</label>
              <select value={form.rol_id} onChange={(e) => setForm({ ...form, rol_id: parseInt(e.target.value) })} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500">
                {roles.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">Username</label>
              <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">{editUser ? 'Nueva Contraseña (dejar vacío)' : 'Contraseña'}</label>
              <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500" required={!editUser} />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="can_change_password" checked={form.can_change_password} onChange={(e) => setForm({ ...form, can_change_password: e.target.checked })} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              <label htmlFor="can_change_password" className="text-xs font-medium text-gray-700 cursor-pointer">Puede cambiar su contraseña</label>
            </div>
          </div>
          <button type="submit" className="flex items-center justify-center gap-2 w-full py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm">
            <Save className="w-4 h-4" /> {editUser ? 'Actualizar' : 'Crear'} Usuario
          </button>
        </form>
      </Modal>

      <Modal isOpen={passwordModal.open} onClose={() => setPasswordModal({ user: null, open: false })} title={`Cambiar Contraseña — ${passwordModal.user?.nombres} ${passwordModal.user?.apellido_paterno}`}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nueva Contraseña</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              minLength={6}
              required
            />
          </div>
          <button
            onClick={handleChangePassword}
            disabled={savingPassword}
            className="flex items-center justify-center gap-2 w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg disabled:opacity-50"
          >
            <Key className="w-4 h-4" /> {savingPassword ? 'Guardando...' : 'Cambiar Contraseña'}
          </button>
        </div>
      </Modal>

      <Modal isOpen={twoFAModal.open} onClose={() => setTwoFAModal({ user: null, open: false, enabled: false })} title={`Autenticación 2FA — ${twoFAModal.user?.nombres} ${twoFAModal.user?.apellido_paterno}`}>
        <div className="space-y-4">
          {twoFAModal.enabled ? (
            <div className="text-center space-y-4">
              <Shield className="w-12 h-12 text-green-600 mx-auto" />
              <p className="text-green-700 font-medium">2FA está habilitado para este usuario.</p>
              <button
                onClick={handleDisable2FA}
                className="flex items-center justify-center gap-2 w-full py-2 bg-danger-600 hover:bg-danger-700 text-white rounded-lg"
              >
                <ShieldOff className="w-4 h-4" /> Desactivar 2FA
              </button>
            </div>
          ) : twoFAQr ? (
            <div className="text-center space-y-4">
              <p className="text-sm text-gray-600">Escanea este código con Google Authenticator:</p>
              <img src={twoFAQr} alt="QR Code" className="mx-auto w-48 h-48" />
              <p className="text-xs text-gray-500 break-all bg-gray-50 p-2 rounded">Secret: {twoFASecret}</p>
              <p className="text-sm text-amber-600">El usuario deberá iniciar sesión y verificar el código 2FA para activarlo.</p>
            </div>
          ) : (
            <div className="text-center space-y-4">
              <Shield className="w-12 h-12 text-gray-400 mx-auto" />
              <p className="text-gray-600">2FA no está configurado para este usuario.</p>
              <button
                onClick={handleSetup2FA}
                disabled={saving2FA}
                className="flex items-center justify-center gap-2 w-full py-2 bg-primary-700 hover:bg-primary-800 text-white rounded-lg disabled:opacity-50"
              >
                <Shield className="w-4 h-4" /> {saving2FA ? 'Configurando...' : 'Configurar 2FA'}
              </button>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
