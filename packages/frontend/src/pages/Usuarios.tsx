import { useState, useEffect } from 'react';
import { userApi, roleApi } from '../services/api';
import { User, Role } from '../types';
import { DataTable } from '../components/DataTable';
import { MobileCard } from '../components/MobileCard';
import { Modal } from '../components/Modal';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { UserPlus, Save } from 'lucide-react';

export default function Usuarios() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [form, setForm] = useState({
    nombres: '', rut: '', dv: '', apellido_paterno: '', apellido_materno: '',
    titulo: '', cargo: '', email: '', username: '', password: '', rol_id: 0,
  });

  const load = async () => {
    try {
      const [uRes, rRes] = await Promise.all([userApi.list(), roleApi.list()]);
      setUsers(uRes.data);
      setRoles(rRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditUser(null);
    setForm({ nombres: '', rut: '', dv: '', apellido_paterno: '', apellido_materno: '', titulo: '', cargo: '', email: '', username: '', password: '', rol_id: roles[0]?.id || 0 });
    setModalOpen(true);
  };

  const openEdit = (user: User) => {
    setEditUser(user);
    setForm({
      nombres: user.nombres, rut: user.rut, dv: user.dv,
      apellido_paterno: user.apellido_paterno, apellido_materno: user.apellido_materno || '',
      titulo: user.titulo || '', cargo: user.cargo, email: user.email,
      username: user.username, password: '', rol_id: user.rol_id,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editUser) {
        await userApi.update(editUser.id, form);
      } else {
        await userApi.create(form);
      }
      setModalOpen(false);
      load();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al guardar usuario');
    }
  };

  const handleSuspend = async (id: number, suspended: boolean) => {
    try {
      await userApi.suspend(id, suspended);
      load();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al cambiar estado');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar este usuario?')) return;
    try {
      await userApi.delete(id);
      load();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al eliminar');
    }
  };

  if (loading) return <LoadingSpinner />;

  const columns = [
    { key: 'nombres', label: 'Nombre', render: (_: any, row: User) => `${row.nombres} ${row.apellido_paterno}` },
    { key: 'rut', label: 'RUT', render: (_: any, row: User) => `${row.rut}-${row.dv}` },
    { key: 'email', label: 'Email' },
    { key: 'cargo', label: 'Cargo' },
    { key: 'rol_nombre', label: 'Rol' },
    { key: 'is_suspended', label: 'Estado', render: (v: boolean) => v ? <span className="text-red-600 font-medium">Suspendido</span> : <span className="text-green-600 font-medium">Activo</span> },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Usuarios</h1>
        <button onClick={openCreate} className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
          <UserPlus className="w-4 h-4" /> Nuevo Usuario
        </button>
      </div>

      <DataTable
        columns={columns}
        data={users}
        onEdit={openEdit}
        onDelete={(row) => handleDelete(row.id)}
      />

      {users.map((u) => (
        <MobileCard key={u.id} onEdit={() => openEdit(u)} onDelete={() => handleDelete(u.id)}>
          <p className="font-medium">{u.nombres} {u.apellido_paterno}</p>
          <p className="text-sm text-gray-500">{u.rut}-{u.dv}</p>
          <p className="text-sm">{u.email}</p>
          <p className="text-sm text-gray-600">{u.cargo} - {u.rol_nombre}</p>
          {u.is_suspended && <span className="text-xs text-red-600 font-medium">Suspendido</span>}
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
          </div>
          <button type="submit" className="flex items-center justify-center gap-2 w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm">
            <Save className="w-4 h-4" /> {editUser ? 'Actualizar' : 'Crear'} Usuario
          </button>
        </form>
      </Modal>
    </div>
  );
}
