import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { permisoApi } from '../services/api';
import { Permiso, Disponibilidad } from '../types';
import { CalendarCheck, CalendarClock, CalendarDays, ClipboardList, ClipboardCheck, Clock, CheckCircle, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../components/Modal';
import { formatDate } from '../utils/format';
import { toast } from '../components/Toast';

function calcularDias(inicio: string, fin: string | null | undefined, tipo: string): number {
  const d1 = new Date(inicio);
  const d2 = fin ? new Date(fin) : d1;
  return tipo === 'media' ? Math.max(1, Math.ceil(Math.abs(d2.getTime() - d1.getTime()) / 86400000) + 1) * 0.5 : Math.max(1, Math.ceil(Math.abs(d2.getTime() - d1.getTime()) / 86400000) + 1);
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [disponibilidad, setDisponibilidad] = useState<Disponibilidad | null>(null);
  const [pendientes, setPendientes] = useState<Permiso[]>([]);
  const [loadingPendientes, setLoadingPendientes] = useState(true);
  const [rechazoModal, setRechazoModal] = useState<{ id: number; open: boolean }>({ id: 0, open: false });
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const [aprobarModal, setAprobarModal] = useState<{ id: number; open: boolean }>({ id: 0, open: false });
  const [comprobanteFile, setComprobanteFile] = useState<File | null>(null);
  const [subiendoComprobante, setSubiendoComprobante] = useState(false);

  const esAdmin = user?.rolId === 1 || user?.rolId === 2;

  useEffect(() => {
    if (user?.rolId === 3) {
      permisoApi.misPermisos()
        .then((res) => setDisponibilidad(res.data.disponibilidad))
        .catch(() => {});
    }
    if (esAdmin) {
      permisoApi.listarTodos()
        .then((res) => setPendientes(res.data.filter((p: Permiso) => p.estado === 'en_revision')))
        .catch(() => {})
        .finally(() => setLoadingPendientes(false));
    }
  }, [user]);

  const handleAprobar = async (id: number) => {
    setAprobarModal({ id, open: true });
    setComprobanteFile(null);
  };

  const confirmarAprobacion = async () => {
    const id = aprobarModal.id;
    setSubiendoComprobante(true);
    try {
      await permisoApi.aprobar(id);
      if (comprobanteFile) {
        await permisoApi.subirComprobante(id, comprobanteFile);
      }
      setPendientes((prev) => prev.filter((p) => p.id !== id));
      setAprobarModal({ id: 0, open: false });
      setComprobanteFile(null);
      toast({ message: 'Permiso aprobado correctamente', type: 'success' });
    } catch (err: any) {
      toast({ message: err.response?.data?.message || 'Error al aprobar', type: 'error' });
    } finally {
      setSubiendoComprobante(false);
    }
  };

  const handleRechazar = async () => {
    try {
      await permisoApi.rechazar(rechazoModal.id, motivoRechazo);
      setPendientes((prev) => prev.filter((p) => p.id !== rechazoModal.id));
      setRechazoModal({ id: 0, open: false });
      setMotivoRechazo('');
      toast({ message: 'Permiso rechazado correctamente', type: 'success' });
    } catch (err: any) {
      toast({ message: err.response?.data?.message || 'Error al rechazar', type: 'error' });
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Dashboard</h1>
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-2">Bienvenido, {user?.nombres} {user?.apellido_paterno}</h2>
        <p className="text-gray-600">Seleccione una opción del menú lateral para comenzar.</p>
      </div>

      {user?.rolId === 3 && disponibilidad && (
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Mis Permisos Administrativos</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg shadow p-5 border-l-4 border-blue-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Permitidos por año</p>
                  <p className="text-3xl font-bold text-blue-600 mt-1">{disponibilidad.max}</p>
                </div>
                <CalendarDays className="w-10 h-10 text-blue-200" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-5 border-l-4 border-amber-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Usados</p>
                  <p className="text-3xl font-bold text-amber-600 mt-1">{disponibilidad.used}</p>
                </div>
                <CalendarCheck className="w-10 h-10 text-amber-200" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-5 border-l-4 border-emerald-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Disponibles</p>
                  <p className={`text-3xl font-bold mt-1 ${disponibilidad.available > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {disponibilidad.available}
                  </p>
                </div>
                <CalendarClock className="w-10 h-10 text-emerald-200" />
              </div>
            </div>
          </div>
          <button
            onClick={() => navigate('/solicitar-permiso')}
            className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors text-sm"
          >
            <ClipboardList className="w-4 h-4" /> Solicitar Permiso
          </button>
        </div>
      )}

      {esAdmin && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Permisos Pendientes de Revisión</h3>
            {pendientes.length > 0 && (
              <button
                onClick={() => navigate('/gestion-permisos')}
                className="text-sm text-primary-600 hover:text-primary-800 font-medium"
              >
                Ver todos
              </button>
            )}
          </div>

          {loadingPendientes ? (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-400">
              <Clock className="w-8 h-8 mx-auto mb-2 animate-pulse" />
              <p className="text-sm">Cargando...</p>
            </div>
          ) : pendientes.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-400">
              <ClipboardCheck className="w-10 h-10 mx-auto mb-2" />
              <p className="text-sm font-medium">No hay permisos pendientes</p>
              <p className="text-xs mt-1">Todos los permisos han sido revisados.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-warning-50 border border-warning-200 rounded-lg px-4 py-2 mb-2 text-sm text-warning-800">
                <Clock className="inline w-4 h-4 mr-1" />
                {pendientes.length} permiso{pendientes.length !== 1 ? 's' : ''} pendiente{pendientes.length !== 1 ? 's' : ''} de revisión
              </div>
              {pendientes.slice(0, 5).map((p) => (
                <div key={p.id} className="bg-white rounded-lg shadow p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-800 truncate">
                      {p.nombres} {p.apellido_paterno}
                    </p>
                    <p className="text-sm text-gray-500">
                      {formatDate(p.fecha_inicio)}{p.fecha_fin ? ` - ${formatDate(p.fecha_fin)}` : ''}
                      <span className="mx-1">·</span>
                      {calcularDias(p.fecha_inicio, p.fecha_fin, p.tipo_jornada)} días
                      <span className="mx-1">·</span>
                      {p.tipo_jornada === 'completa' ? 'Completa' : 'Media'}
                    </p>
                    <p className="text-sm text-gray-600 truncate">{p.motivo}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => handleAprobar(p.id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-success-600 hover:bg-success-700 text-white text-sm rounded-lg transition-colors"
                    >
                      <CheckCircle className="w-3.5 h-3.5" /> Aprobar
                    </button>
                    <button
                      onClick={() => setRechazoModal({ id: p.id, open: true })}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-danger-600 hover:bg-danger-700 text-white text-sm rounded-lg transition-colors"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Rechazar
                    </button>
                  </div>
                </div>
              ))}
              {pendientes.length > 5 && (
                <p className="text-center text-sm text-gray-500">
                  ... y {pendientes.length - 5} más.{' '}
                  <button onClick={() => navigate('/gestion-permisos')} className="text-primary-600 hover:text-primary-800 font-medium">
                    Ver todos en Gestión de Permisos
                  </button>
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <Modal isOpen={aprobarModal.open} onClose={() => setAprobarModal({ id: 0, open: false })} title="Aprobar Permiso">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">¿Estás seguro de aprobar este permiso?</p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Comprobante (PDF o imagen con firma)</label>
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.gif"
              onChange={(e) => setComprobanteFile(e.target.files?.[0] || null)}
              className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            <p className="text-xs text-gray-400 mt-1">Opcional. Máx. 10 MB.</p>
          </div>
          <button
            onClick={confirmarAprobacion}
            disabled={subiendoComprobante}
            className="flex items-center justify-center gap-2 w-full py-2 bg-success-600 hover:bg-success-700 text-white rounded-lg disabled:opacity-50"
          >
            <CheckCircle className="w-4 h-4" /> {subiendoComprobante ? 'Aprobando...' : 'Confirmar Aprobación'}
          </button>
        </div>
      </Modal>

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
          <button
            onClick={handleRechazar}
            className="flex items-center justify-center gap-2 w-full py-2 bg-danger-600 hover:bg-danger-700 text-white rounded-lg"
          >
            <XCircle className="w-4 h-4" /> Rechazar Permiso
          </button>
        </div>
      </Modal>
    </div>
  );
}
