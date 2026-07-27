import { useState, useEffect } from 'react';
import { sessionApi } from '../services/api';
import { Session } from '../types';
import { DataTable } from '../components/DataTable';
import { MobileCard } from '../components/MobileCard';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { toast } from '../components/Toast';
import { LogOut } from 'lucide-react';

export default function Sesiones() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const res = await sessionApi.list();
      setSessions(res.data);
    } catch {
      toast({ message: 'Error al cargar sesiones', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar esta sesión?')) return;
    try {
      await sessionApi.delete(id);
      load();
    } catch (err: any) {
      toast({ message: err.response?.data?.message || 'Error al eliminar sesión', type: 'error' });
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm('¿Cerrar todas las sesiones de usuario?\nTu sesión actual no se verá afectada.')) return;
    try {
      await sessionApi.deleteAll();
      toast({ message: 'Todas las sesiones han sido cerradas', type: 'success' });
      load();
    } catch (err: any) {
      toast({ message: err.response?.data?.message || 'Error al cerrar sesiones', type: 'error' });
    }
  };

  if (loading) return <LoadingSpinner />;

  const columns = [
    { key: 'nombres', label: 'Usuario', render: (_: any, row: Session) => `${row.nombres} ${row.apellido_paterno} (${row.username})` },
    { key: 'created_at', label: 'Inicio Sesión', render: (v: string) => new Date(v).toLocaleString() },
    { key: 'expires_at', label: 'Expira', render: (v: string) => new Date(v).toLocaleString() },
    { key: 'last_activity', label: 'Última Actividad', render: (v: string) => new Date(v).toLocaleString() },
  ];

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Sesiones Activas</h1>
        {sessions.length > 0 && (
          <button
            onClick={handleDeleteAll}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
          >
            <LogOut className="w-4 h-4" /> Cerrar Todas
          </button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={sessions}
        onDelete={(row) => handleDelete(row.id)}
      />

      {sessions.map((s) => (
        <MobileCard key={s.id} onDelete={() => handleDelete(s.id)}>
          <p className="font-medium">{s.nombres} {s.apellido_paterno}</p>
          <p className="text-sm text-gray-500">@{s.username}</p>
          <p className="text-xs text-gray-400">Inicio: {new Date(s.created_at).toLocaleString()}</p>
          <p className="text-xs text-gray-400">Expira: {new Date(s.expires_at).toLocaleString()}</p>
        </MobileCard>
      ))}
    </div>
  );
}
