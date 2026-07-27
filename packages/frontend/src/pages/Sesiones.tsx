import { useState, useEffect } from 'react';
import { sessionApi } from '../services/api';
import { Session } from '../types';
import { DataTable } from '../components/DataTable';
import { MobileCard } from '../components/MobileCard';
import { LoadingSpinner } from '../components/LoadingSpinner';

export default function Sesiones() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const res = await sessionApi.list();
      setSessions(res.data);
    } catch (err) {
      console.error(err);
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
      alert(err.response?.data?.message || 'Error al eliminar sesión');
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
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Sesiones Activas</h1>

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
