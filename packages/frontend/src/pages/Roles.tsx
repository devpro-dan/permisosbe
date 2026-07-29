import { useState, useEffect } from 'react';
import { roleApi } from '../services/api';
import { Role, RolePermission } from '../types';
import { DataTable } from '../components/DataTable';
import { MobileCard } from '../components/MobileCard';
import { Modal } from '../components/Modal';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { Plus, Shield, Save } from 'lucide-react';

const SECCIONES = ['usuarios', 'roles', 'permisos_administrativos', 'reportes', 'configuracion', 'sesiones', 'audit_log'];

export default function Roles() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [permModal, setPermModal] = useState<{ role: Role | null; open: boolean }>({ role: null, open: false });
  const [permissions, setPermissions] = useState<RolePermission[]>([]);
  const [form, setForm] = useState({ nombre: '', descripcion: '' });
  const [editRole, setEditRole] = useState<Role | null>(null);

  const load = async () => {
    try {
      const res = await roleApi.list();
      setRoles(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openPermModal = async (role: Role) => {
    try {
      const res = await roleApi.getPermissions(role.id);
      setPermissions(res.data);
      setPermModal({ role, open: true });
    } catch (err) {
      console.error(err);
    }
  };

  const togglePerm = (seccion: string, field: keyof RolePermission) => {
    setPermissions((prev) =>
      prev.map((p) =>
        p.seccion === seccion ? { ...p, [field]: !p[field] } : p
      )
    );
  };

  const savePermissions = async () => {
    if (!permModal.role) return;
    try {
      for (const perm of permissions) {
        await roleApi.setPermission(permModal.role.id, {
          seccion: perm.seccion,
          can_view: perm.can_view,
          can_create: perm.can_create,
          can_edit: perm.can_edit,
          can_delete: perm.can_delete,
        });
      }
      setPermModal({ role: null, open: false });
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al guardar permisos');
    }
  };

  const openCreate = () => {
    setEditRole(null);
    setForm({ nombre: '', descripcion: '' });
    setModalOpen(true);
  };

  const openEdit = (role: Role) => {
    setEditRole(role);
    setForm({ nombre: role.nombre, descripcion: role.descripcion || '' });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editRole) {
        await roleApi.update(editRole.id, form);
      } else {
        await roleApi.create(form);
      }
      setModalOpen(false);
      load();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al guardar rol');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar este rol?')) return;
    try {
      await roleApi.delete(id);
      load();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al eliminar');
    }
  };

  if (loading) return <LoadingSpinner />;

  const columns = [
    { key: 'nombre', label: 'Nombre' },
    { key: 'descripcion', label: 'Descripción', render: (v: string) => v || '-' },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Roles</h1>
        <button onClick={openCreate} className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700">
          <Plus className="w-4 h-4" /> Nuevo Rol
        </button>
      </div>

      <DataTable
        columns={columns}
        data={roles}
        onEdit={openEdit}
        onDelete={(row) => handleDelete(row.id)}
      />

      {roles.map((r) => (
        <MobileCard key={r.id} onEdit={() => openEdit(r)} onDelete={() => handleDelete(r.id)}>
          <p className="font-medium">{r.nombre}</p>
          <p className="text-sm text-gray-500">{r.descripcion || '-'}</p>
          <button onClick={() => openPermModal(r)} className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 mt-2">
            <Shield className="w-3.5 h-3.5" /> Gestionar Permisos
          </button>
        </MobileCard>
      ))}

      {roles.length > 0 && (
        <div className="hidden md:block mt-4">
          <h2 className="font-semibold text-gray-700 mb-2">Permisos por Rol</h2>
          <div className="grid gap-3">
            {roles.map((r) => (
              <div key={r.id} className="bg-white rounded-lg shadow p-4 flex items-center justify-between">
                <span className="font-medium">{r.nombre}</span>
                <button onClick={() => openPermModal(r)} className="inline-flex items-center gap-1 px-3 py-1 bg-primary-700 text-white rounded-lg text-sm hover:bg-primary-800">
                  <Shield className="w-3.5 h-3.5" /> Gestionar Permisos
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editRole ? 'Editar Rol' : 'Nuevo Rol'}>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
            <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <textarea value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} rows={3} className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <button type="submit" className="flex items-center justify-center gap-2 w-full py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg">
            <Save className="w-4 h-4" /> {editRole ? 'Actualizar' : 'Crear'} Rol
          </button>
        </form>
      </Modal>

      <Modal isOpen={permModal.open} onClose={() => setPermModal({ role: null, open: false })} title={`Permisos: ${permModal.role?.nombre}`}>
        <div className="space-y-4">
          {SECCIONES.map((seccion) => {
            const perm = permissions.find((p) => p.seccion === seccion) || {
              seccion, can_view: false, can_create: false, can_edit: false, can_delete: false,
            } as RolePermission;
            return (
              <div key={seccion} className="border rounded-lg p-3">
                <p className="font-medium text-sm capitalize mb-2">{seccion.replace(/_/g, ' ')}</p>
                <div className="flex gap-4">
                  {(['can_view', 'can_create', 'can_edit', 'can_delete'] as (keyof RolePermission)[]).map((field) => (
                    <label key={field} className="flex items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        checked={perm[field] as boolean}
                        onChange={() => togglePerm(seccion, field)}
                        className="rounded"
                      />
                      {field === 'can_view' ? 'Ver' : field === 'can_create' ? 'Crear' : field === 'can_edit' ? 'Editar' : 'Eliminar'}
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
          <button onClick={savePermissions} className="flex items-center justify-center gap-2 w-full py-2 bg-success-600 hover:bg-success-700 text-white rounded-lg">
            <Save className="w-4 h-4" /> Guardar Permisos
          </button>
        </div>
      </Modal>
    </div>
  );
}
