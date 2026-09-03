import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { permisoApi } from '../services/api';
import { Permiso, Disponibilidad } from '../types';
import { CalendarCheck, CalendarClock, CalendarDays, ClipboardList, ClipboardCheck, Clock, CheckCircle, XCircle, Trophy, AlertTriangle, Crown, Users, TrendingUp, Medal, Flame, ChevronDown, ChevronUp } from 'lucide-react';
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

  const esAdmin = user?.rolId === 1 || user?.rolId === 2;
  const [indicadores, setIndicadores] = useState<any>(null);
  const [loadingIndicadores, setLoadingIndicadores] = useState(true);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggle = (k: string) => setCollapsed((p) => ({ ...p, [k]: !p[k] }));

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
      permisoApi.dashboardIndicadores()
        .then((res) => setIndicadores(res.data))
        .catch(() => {})
        .finally(() => setLoadingIndicadores(false));
    }
  }, [user]);

  const handleAprobar = async (id: number) => {
    try {
      await permisoApi.aprobar(id);
      setPendientes((prev) => prev.filter((p) => p.id !== id));
      toast({ message: 'Permiso aprobado correctamente', type: 'success' });
    } catch (err: any) {
      toast({ message: err.response?.data?.message || 'Error al aprobar', type: 'error' });
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
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-primary-600" /> Indicadores</h3>
          {loadingIndicadores ? (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-400"><Clock className="w-8 h-8 mx-auto mb-2 animate-pulse" /><p className="text-sm">Cargando indicadores...</p></div>
          ) : !indicadores ? (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-400"><AlertTriangle className="w-8 h-8 mx-auto mb-2" /><p className="text-sm">No se pudieron cargar los indicadores</p></div>
          ) : (
          <div className="space-y-4">
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <button onClick={() => toggle('resumen')} className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 text-left">
                <span className="font-semibold text-gray-800 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary-600" /> Resumen</span>
                {collapsed['resumen'] ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronUp className="w-4 h-4 text-gray-500" />}
              </button>
              {!collapsed['resumen'] && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 pt-0">
            <div className="bg-white rounded-lg shadow p-5 border-l-4 border-primary-500">
              <div className="flex items-center justify-between">
                <div><p className="text-sm text-gray-500">Pendientes</p><p className="text-3xl font-bold text-primary-600 mt-1">{indicadores.pendientes}</p></div>
                <Clock className="w-10 h-10 text-primary-200" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-5 border-l-4 border-emerald-500">
              <div className="flex items-center justify-between">
                <div><p className="text-sm text-gray-500">Aprobados este mes</p><p className="text-3xl font-bold text-emerald-600 mt-1">{indicadores.aprobadosMes}</p></div>
                <CheckCircle className="w-10 h-10 text-emerald-200" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-5 border-l-4 border-red-500">
              <div className="flex items-center justify-between">
                <div><p className="text-sm text-gray-500">Sin cupo ({indicadores.agotados?.length || 0})</p><p className="text-3xl font-bold text-red-600 mt-1">{indicadores.agotados?.length || 0}</p><p className="text-xs text-gray-400">de {indicadores.totalUsuarios} usuarios</p></div>
                <AlertTriangle className="w-10 h-10 text-red-200" />
              </div>
            </div>
          </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-lg shadow overflow-hidden bg-gradient-to-br from-amber-400 to-orange-500">
                <button onClick={() => toggle('top')} className="w-full flex items-center justify-between px-4 py-3 text-white text-left">
                  <span className="font-semibold flex items-center gap-2"><Crown className="w-4 h-4" /> Top del mes</span>
                  {collapsed['top'] ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                </button>
                {!collapsed['top'] && (
                <div className="p-5 pt-0 text-white">
              <div className="flex items-start justify-between relative z-10">
                <div className="flex-1">
                  {indicadores.topMes ? (
                    <>
                      <p className="text-xl font-bold mt-1">{indicadores.topMes.user.nombres} {indicadores.topMes.user.apellido_paterno}</p>
                      <p className="text-sm text-white/80">{indicadores.topMes.user.cargo || '—'} · {indicadores.topMes.user.rut}-{indicadores.topMes.user.dv}</p>
                      <div className="mt-3 flex items-center gap-3">
                        <span className="bg-white/20 backdrop-blur px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1"><Trophy className="w-4 h-4" /> {indicadores.topMes.count} permiso{indicadores.topMes.count !== 1 ? 's' : ''}</span>
                        <span className="bg-white text-orange-600 px-3 py-1 rounded-full text-sm font-bold">{indicadores.topMes.dias} día{indicadores.topMes.dias !== 1 ? 's' : ''}</span>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm mt-2 text-white/80">Sin permisos este mes</p>
                  )}
                </div>
                <Trophy className="w-16 h-16 text-white/20" />
              </div>
                </div>
                )}
              </div>

              <div className="bg-white rounded-lg shadow overflow-hidden">
                <button onClick={() => toggle('ranking')} className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 text-left">
                  <span className="font-semibold text-gray-800 flex items-center gap-2"><Medal className="w-4 h-4 text-amber-500" /> Ranking del mes (Top 5)</span>
                  {collapsed['ranking'] ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronUp className="w-4 h-4 text-gray-500" />}
                </button>
                {!collapsed['ranking'] && (
                <div className="p-5 pt-0">
              {indicadores.rankingMes?.length ? indicadores.rankingMes.map((r: any, i: number) => (
                <div key={r.user.id} className="flex items-center gap-3 py-2 border-b last:border-0">
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-gray-100 text-gray-600' : i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-gray-50 text-gray-500'}`}>{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{r.user.nombres} {r.user.apellido_paterno}</p>
                    <p className="text-xs text-gray-400 truncate">{r.user.cargo || '—'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-800">{r.count} <span className="text-xs font-normal text-gray-500">perm.</span></p>
                    <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1"><div className="h-full bg-primary-500" style={{ width: `${Math.min(100, (r.count / (indicadores.rankingMes[0]?.count || 1)) * 100)}%` }} /></div>
                  </div>
                </div>
              )) : <p className="text-sm text-gray-400 text-center py-4">Sin datos este mes</p>}
                </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white rounded-lg shadow overflow-hidden border border-red-100">
                <button onClick={() => toggle('agotados')} className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 text-left">
                  <span className="font-semibold text-red-700 flex items-center gap-2"><Flame className="w-4 h-4" /> Sin cupo disponible ({indicadores.agotados?.length || 0})</span>
                  {collapsed['agotados'] ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronUp className="w-4 h-4 text-gray-500" />}
                </button>
                {!collapsed['agotados'] && (
                <div className="p-5 pt-0">
              {indicadores.agotados?.length ? (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {indicadores.agotados.map((u: any) => (
                    <div key={u.id} className="flex items-center justify-between p-2.5 bg-red-50 rounded-lg border border-red-100">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{u.nombres} {u.apellido_paterno} {u.apellido_materno || ''}</p>
                        <p className="text-xs text-gray-500">{u.rut}-{u.dv} · {u.cargo || '—'}</p>
                      </div>
                      <span className="shrink-0 bg-red-600 text-white text-xs font-bold px-2.5 py-1 rounded-full">{u.usados}/{u.max} usados</span>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-gray-400 text-center py-6">Nadie ha agotado su cupo aún 🎉</p>}
                </div>
                )}
              </div>
              <div className="bg-white rounded-lg shadow overflow-hidden border border-amber-100">
                <button onClick={() => toggle('porAgotarse')} className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 text-left">
                  <span className="font-semibold text-amber-700 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Por agotarse — 1 día restante ({indicadores.porAgotarse?.length || 0})</span>
                  {collapsed['porAgotarse'] ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronUp className="w-4 h-4 text-gray-500" />}
                </button>
                {!collapsed['porAgotarse'] && (
                <div className="p-5 pt-0">
              {indicadores.porAgotarse?.length ? (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {indicadores.porAgotarse.map((u: any) => (
                    <div key={u.id} className="flex items-center justify-between p-2.5 bg-amber-50 rounded-lg border border-amber-100">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{u.nombres} {u.apellido_paterno}</p>
                        <p className="text-xs text-gray-500">{u.rut}-{u.dv} · {u.cargo || '—'}</p>
                      </div>
                      <span className="shrink-0 bg-amber-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">{u.usados}/{u.max}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-gray-400 text-center py-6">Nadie está por agotar su cupo</p>}
                </div>
                )}
              </div>
            </div>
          </div>
        )}
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
