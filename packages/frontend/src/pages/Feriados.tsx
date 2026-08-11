import { useState, useEffect } from 'react';
import { feriadoApi } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { DataTable } from '../components/DataTable';
import { MobileCard } from '../components/MobileCard';
import { Modal } from '../components/Modal';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { toast } from '../components/Toast';
import { CalendarPlus, Save } from 'lucide-react';
import { formatDate } from '../utils/format';

interface Feriado {
  id: number;
  fecha: string;
  descripcion: string;
}

export default function Feriados() {
  const { user } = useAuth();
  const canCreate = user?.permissions?.some((p) => p.seccion === 'feriados' && p.can_create) ?? false;
  const canEdit = user?.permissions?.some((p) => p.seccion === 'feriados' && p.can_edit) ?? false;
  const canDelete = user?.permissions?.some((p) => p.seccion === 'feriados' && p.can_delete) ?? false;

  const [feriados, setFeriados] = useState<Feriado[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editFeriado, setEditFeriado] = useState<Feriado | null>(null);
  const [form, setForm] = useState({ fecha: '', descripcion: '' });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const res = await feriadoApi.list();
      setFeriados(res.data);
    } catch {
      toast({ message: 'Error al cargar feriados', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditFeriado(null);
    setForm({ fecha: '', descripcion: '' });
    setModalOpen(true);
  };

  const openEdit = (feriado: Feriado) => {
    setEditFeriado(feriado);
    setForm({ fecha: feriado.fecha, descripcion: feriado.descripcion });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fecha) {
      toast({ message: 'Ingrese una fecha', type: 'error' });
      return;
    }
    if (!form.descripcion.trim()) {
      toast({ message: 'Ingrese una descripción', type: 'error' });
      return;
    }
    setSaving(true);
    try {
      if (editFeriado) {
        await feriadoApi.update(editFeriado.id, form);
        toast({ message: 'Feriado actualizado correctamente', type: 'success' });
      } else {
        await feriadoApi.create(form);
        toast({ message: 'Feriado creado correctamente', type: 'success' });
      }
      setModalOpen(false);
      load();
    } catch (err: any) {
      toast({ message: err.response?.data?.message || 'Error al guardar feriado', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar este feriado?')) return;
    try {
      await feriadoApi.delete(id);
      toast({ message: 'Feriado eliminado', type: 'success' });
      load();
    } catch (err: any) {
      toast({ message: err.response?.data?.message || 'Error al eliminar feriado', type: 'error' });
    }
  };

  if (loading) return <LoadingSpinner />;

  const columns = [
    { key: 'fecha', label: 'Fecha', render: (v: string) => formatDate(v) },
    { key: 'descripcion', label: 'Descripción' },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Feriados</h1>
        {canCreate && (
          <button onClick={openCreate} className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700">
            <CalendarPlus className="w-4 h-4" /> Nuevo Feriado
          </button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={feriados}
        onEdit={canEdit ? openEdit : undefined}
        onDelete={canDelete ? (row) => handleDelete(row.id) : undefined}
      />

      {feriados.map((f) => (
        <MobileCard
          key={f.id}
          onEdit={canEdit ? () => openEdit(f) : undefined}
          onDelete={canDelete ? () => handleDelete(f.id) : undefined}
        >
          <p className="font-medium">{formatDate(f.fecha)}</p>
          <p className="text-sm text-gray-600">{f.descripcion}</p>
        </MobileCard>
      ))}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editFeriado ? 'Editar Feriado' : 'Nuevo Feriado'}>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
            <input
              type="date"
              value={form.fecha}
              onChange={(e) => setForm({ ...form, fecha: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <textarea
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              rows={3}
              placeholder="Ej: Año Nuevo (irrenunciable)"
              className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <button type="submit" disabled={saving} className="flex items-center justify-center gap-2 w-full py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm disabled:opacity-50">
            <Save className="w-4 h-4" /> {saving ? 'Guardando...' : editFeriado ? 'Actualizar' : 'Crear'} Feriado
          </button>
        </form>
      </Modal>
    </div>
  );
}
