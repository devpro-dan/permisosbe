import { useState, useEffect } from 'react';
import { auditLogApi } from '../services/api';
import { AuditLog as AuditLogType } from '../types';
import { DataTable } from '../components/DataTable';
import { MobileCard } from '../components/MobileCard';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { History, Search, Filter, Calendar } from 'lucide-react';
import { formatDate } from '../utils/format';

export default function AuditLog() {
  const [logs, setLogs] = useState<AuditLogType[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [entidad, setEntidad] = useState('');
  const [accion, setAccion] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [page, setPage] = useState(0);
  const limit = 50;

  const load = () => {
    setLoading(true);
    const params: Record<string, string | number> = { limit, offset: page * limit };
    if (entidad) params.entidad = entidad;
    if (accion) params.accion = accion;
    if (desde) params.desde = desde;
    if (hasta) params.hasta = hasta;
    auditLogApi.list(params)
      .then((res) => { setLogs(res.data.rows); setTotal(res.data.total); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [page]);

  const handleFilter = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    load();
  };

  const columns = [
    { key: 'created_at', label: 'Fecha', render: (v: string) => formatDate(v) },
    { key: 'username', label: 'Usuario' },
    { key: 'accion', label: 'Acción', render: (v: string) => {
      const labels: Record<string, string> = {
        create: 'Crear', update: 'Editar', delete: 'Eliminar',
        approve: 'Aprobar', reject: 'Rechazar', create_for_user: 'Registrar para',
        login: 'Inicio sesión', suspend: 'Suspender', activate: 'Activar',
        set_permission: 'Configurar permisos',
      };
      return <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">{labels[v] || v}</span>;
    }},
    { key: 'entidad', label: 'Entidad', render: (v: string) => {
      const labels: Record<string, string> = { permiso: 'Permiso', usuario: 'Usuario', rol: 'Rol', config: 'Config', auth: 'Autenticación' };
      return labels[v] || v;
    }},
    { key: 'entidad_id', label: 'ID', render: (v: number | null) => v ?? '-' },
    { key: 'detalle', label: 'Detalle' },
  ];

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-2">Auditoría del Sistema</h1>
      <p className="text-gray-500 mb-6">Registro detallado de todas las acciones realizadas en el sistema.</p>

      <form onSubmit={handleFilter} className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Entidad</label>
            <select value={entidad} onChange={(e) => setEntidad(e.target.value)} className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-primary-500 bg-white">
              <option value="">Todas</option>
              <option value="permiso">Permiso</option>
              <option value="usuario">Usuario</option>
              <option value="rol">Rol</option>
              <option value="config">Configuración</option>
              <option value="auth">Autenticación</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Acción</label>
            <select value={accion} onChange={(e) => setAccion(e.target.value)} className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-primary-500 bg-white">
              <option value="">Todas</option>
              <option value="create">Crear</option>
              <option value="update">Editar</option>
              <option value="delete">Eliminar</option>
              <option value="approve">Aprobar</option>
              <option value="reject">Rechazar</option>
              <option value="login">Inicio sesión</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1"><Calendar className="inline w-4 h-4 mr-1" />Desde</label>
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1"><Calendar className="inline w-4 h-4 mr-1" />Hasta</label>
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
        </div>
        <div className="flex gap-3 mt-4">
          <button type="submit" disabled={loading} className="inline-flex items-center gap-2 px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50">
            <Filter className="w-4 h-4" /> Filtrar
          </button>
          <button type="button" onClick={() => { setEntidad(''); setAccion(''); setDesde(''); setHasta(''); setPage(0); }} className="inline-flex items-center gap-2 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors">
            Limpiar
          </button>
        </div>
      </form>

      {loading ? (
        <LoadingSpinner message="Cargando registros de auditoría..." />
      ) : (
        <>
          <div className="flex items-center justify-between bg-primary-50 border border-primary-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-primary-800">
              <History className="inline w-4 h-4 mr-1" />
              {total} registro{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}
            </p>
          </div>

          <DataTable columns={columns} data={logs} />

          {logs.map((l) => (
            <MobileCard key={l.id}>
              <p className="text-xs text-gray-500">{formatDate(l.created_at)}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm font-medium">{l.username}</span>
                <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-medium">{l.accion}</span>
              </div>
              <p className="text-sm text-gray-700 mt-1">{l.entidad}{l.entidad_id ? ` #${l.entidad_id}` : ''}</p>
              {l.detalle && <p className="text-sm text-gray-500 mt-1">{l.detalle}</p>}
            </MobileCard>
          ))}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} className="px-4 py-2 border rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50">Anterior</button>
              <span className="text-sm text-gray-600">Página {page + 1} de {totalPages}</span>
              <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1} className="px-4 py-2 border rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50">Siguiente</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
