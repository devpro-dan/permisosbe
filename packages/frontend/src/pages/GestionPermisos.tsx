import { useState, useEffect } from 'react';
import { permisoApi } from '../services/api';
import { Permiso } from '../types';
import { DataTable } from '../components/DataTable';
import { MobileCard } from '../components/MobileCard';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { Modal } from '../components/Modal';
import { CheckCircle, XCircle, Trash2 } from 'lucide-react';
import { formatDate } from '../utils/format';

export default function GestionPermisos() {
  const [permisos, setPermisos] = useState<Permiso[]>([]);
  const [loading, setLoading] = useState(true);
  const [rechazoModal, setRechazoModal] = useState<{ id: number; open: boolean }>({ id: 0, open: false });
  const [motivoRechazo, setMotivoRechazo] = useState('');

  const load = () => {
    setLoading(true);
    permisoApi.listarTodos()
      .then((res) => setPermisos(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleAprobar = async (id: number) => {
    if (!confirm('¿Aprobar este permiso?')) return;
    try {
      await permisoApi.aprobar(id);
      load();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al aprobar');
    }
  };

  const handleRechazar = async () => {
    try {
      await permisoApi.rechazar(rechazoModal.id, motivoRechazo);
      setRechazoModal({ id: 0, open: false });
      setMotivoRechazo('');
      load();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al rechazar');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar este permiso?')) return;
    try {
      await permisoApi.delete(id);
      load();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al eliminar');
    }
  };

  const estadoBadge = (estado: string) => {
    const colors: Record<string, string> = {
      en_revision: 'bg-yellow-100 text-yellow-800',
      aprobado: 'bg-green-100 text-green-800',
      rechazado: 'bg-red-100 text-red-800',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[estado] || 'bg-gray-100'}`}>
        {estado === 'en_revision' ? 'En Revisión' : estado === 'aprobado' ? 'Aprobado' : 'Rechazado'}
      </span>
    );
  };

  if (loading) return <LoadingSpinner message="Cargando permisos..." />;

  const columns = [
    { key: 'nombres', label: 'Trabajador', render: (_: any, row: Permiso) => `${row.nombres} ${row.apellido_paterno}` },
    { key: 'rut', label: 'RUT', render: (_: any, row: Permiso) => `${row.rut}-${row.dv}` },
    { key: 'fecha_inicio', label: 'Inicio', render: (v: string) => formatDate(v) },
    { key: 'fecha_fin', label: 'Fin', render: (v: string) => formatDate(v) },
    { key: 'tipo_jornada', label: 'Jornada', render: (v: string) => v === 'completa' ? 'Completa' : 'Media' },
    { key: 'estado', label: 'Estado', render: (_: any, row: Permiso) => estadoBadge(row.estado) },
    { key: 'motivo', label: 'Motivo' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Gestión de Permisos</h1>

      <DataTable
        columns={columns}
        data={permisos}
        onDelete={(row) => handleDelete(row.id)}
      />

      {permisos.map((p) => (
        <MobileCard key={p.id} onDelete={() => handleDelete(p.id)}>
          <p className="font-medium">{p.nombres} {p.apellido_paterno}</p>
          <p className="text-sm text-gray-500">{p.rut}-{p.dv}</p>
          <p className="text-sm">{formatDate(p.fecha_inicio)}{p.fecha_fin ? ` - ${formatDate(p.fecha_fin)}` : ''}</p>
          <div className="flex items-center gap-2">
            {estadoBadge(p.estado)}
            <span className="text-xs text-gray-500">{p.tipo_jornada === 'completa' ? 'Completa' : 'Media'}</span>
          </div>
          <p className="text-sm text-gray-600">{p.motivo}</p>
          {p.estado === 'en_revision' && (
            <div className="flex gap-2 mt-2">
              <button onClick={() => handleAprobar(p.id)} className="inline-flex items-center gap-1 text-sm px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700">
                <CheckCircle className="w-3.5 h-3.5" /> Aprobar
              </button>
              <button onClick={() => setRechazoModal({ id: p.id, open: true })} className="inline-flex items-center gap-1 text-sm px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700">
                <XCircle className="w-3.5 h-3.5" /> Rechazar
              </button>
            </div>
          )}
        </MobileCard>
      ))}

      {permisos.length > 0 && (
        <div className="hidden md:block">
          {permisos.filter(p => p.estado === 'en_revision').length > 0 && (
            <div className="mt-4 space-y-2">
              <h2 className="font-semibold text-gray-700 mb-2">Acciones Pendientes</h2>
              <div className="grid gap-2">
                {permisos.filter(p => p.estado === 'en_revision').map((p) => (
                  <div key={p.id} className="bg-white rounded-lg shadow p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium">{p.nombres} {p.apellido_paterno}</p>
                      <p className="text-sm text-gray-500">{formatDate(p.fecha_inicio)} - {p.motivo}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleAprobar(p.id)} className="inline-flex items-center gap-1 px-3 py-1 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"><CheckCircle className="w-3.5 h-3.5" /> Aprobar</button>
                      <button onClick={() => setRechazoModal({ id: p.id, open: true })} className="inline-flex items-center gap-1 px-3 py-1 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"><XCircle className="w-3.5 h-3.5" /> Rechazar</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <Modal isOpen={rechazoModal.open} onClose={() => setRechazoModal({ id: 0, open: false })} title="Rechazar Permiso">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Motivo de Rechazo</label>
            <textarea
              value={motivoRechazo}
              onChange={(e) => setMotivoRechazo(e.target.value)}
              rows={4}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              required
            />
          </div>
          <button onClick={handleRechazar} className="flex items-center justify-center gap-2 w-full py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg">
            <XCircle className="w-4 h-4" /> Rechazar Permiso
          </button>
        </div>
      </Modal>
    </div>
  );
}
