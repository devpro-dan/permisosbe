import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { permisoApi, feriadoApi } from '../services/api';
import { Permiso } from '../types';
import { DataTable } from '../components/DataTable';
import { MobileCard } from '../components/MobileCard';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { Modal } from '../components/Modal';
import { toast } from '../components/Toast';
import { CheckCircle, XCircle, Trash2, FileText, Search, Calendar, X, Upload, Pencil } from 'lucide-react';
import { formatDate } from '../utils/format';
import { isWeekend, addBusinessDays } from '../utils/dates';

const calcularDias = (fechaInicio: string, fechaFin: string | null | undefined, tipoJornada: string): number => {
  const inicio = new Date(fechaInicio);
  const fin = fechaFin ? new Date(fechaFin) : new Date(fechaInicio);
  
  const diffTime = Math.abs(fin.getTime() - inicio.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  
  return tipoJornada === 'media' ? diffDays * 0.5 : diffDays;
};

const countBusinessDays = (inicio: string, fin: string): number => {
  const d1 = new Date(inicio + 'T12:00:00');
  const d2 = new Date(fin + 'T12:00:00');
  let count = 0;
  const cur = new Date(d1);
  while (cur <= d2) {
    if (cur.getDay() !== 0 && cur.getDay() !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
};

export default function GestionPermisos() {
  const { user } = useAuth();
  const [permisos, setPermisos] = useState<Permiso[]>([]);
  const [loading, setLoading] = useState(true);
  const [rechazoModal, setRechazoModal] = useState<{ id: number; open: boolean }>({ id: 0, open: false });
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingId, setUploadingId] = useState<number | null>(null);

  const [editModal, setEditModal] = useState<{ permiso: Permiso | null; open: boolean }>({ permiso: null, open: false });
  const [editFechaInicio, setEditFechaInicio] = useState('');
  const [editCantidadDias, setEditCantidadDias] = useState(1);
  const [editTipoJornada, setEditTipoJornada] = useState<'completa' | 'media'>('completa');
  const [editMotivo, setEditMotivo] = useState('');
  const [editError, setEditError] = useState('');
  const [feriados, setFeriados] = useState<string[]>([]);

  const puedeEditar = user?.rolId === 1 || user?.rolId === 2;

  useEffect(() => {
    feriadoApi.list(new Date().getFullYear()).then((res) => {
      setFeriados(res.data.map((f: any) => f.fecha));
    }).catch(() => {});
  }, []);

  const load = () => {
    setLoading(true);
    permisoApi.listarTodos()
      .then((res) => setPermisos(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const permisosFiltrados = useMemo(() => {
    return permisos.filter((p) => {
      const nombreCompleto = `${p.nombres} ${p.apellido_paterno}`.toLowerCase();
      const rut = `${p.rut}${p.dv}`.toLowerCase();
      const searchMatch = searchTerm === '' || nombreCompleto.includes(searchTerm.toLowerCase()) || rut.includes(searchTerm.toLowerCase());

      let dateMatch = true;
      if (fechaInicio || fechaFin) {
        const permisoInicio = new Date(p.fecha_inicio);
        const permisoFin = p.fecha_fin ? new Date(p.fecha_fin) : permisoInicio;
        
        if (fechaInicio) {
          const filterInicio = new Date(fechaInicio);
          dateMatch = dateMatch && (permisoFin >= filterInicio);
        }
        
        if (fechaFin) {
          const filterFin = new Date(fechaFin);
          dateMatch = dateMatch && (permisoInicio <= filterFin);
        }
      }

      return searchMatch && dateMatch;
    });
  }, [permisos, searchTerm, fechaInicio, fechaFin]);

  const handleAprobar = async (id: number) => {
    if (!confirm('¿Aprobar este permiso?')) return;
    try {
      await permisoApi.aprobar(id);
      load();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al aprobar');
    }
  };

  const handleUploadClick = (id: number) => {
    setUploadingId(id);
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadingId) return;
    try {
      await permisoApi.subirComprobante(uploadingId, file);
      toast({ message: 'Comprobante subido correctamente', type: 'success' });
      load();
    } catch (err: any) {
      toast({ message: err.response?.data?.message || 'Error al subir comprobante', type: 'error' });
    } finally {
      setUploadingId(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
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

  const handleDescargarComprobante = async (id: number) => {
    try {
      const res = await permisoApi.descargarComprobante(id);
      const ct = String(res.headers['content-type'] || '');
      const ext = ct.includes('pdf') ? '.pdf' : ct.includes('png') ? '.png' : '.jpg';
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `comprobante_permiso_${id}${ext}`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al descargar comprobante');
    }
  };

  const handleDescargarCertificado = async (id: number) => {
    try {
      const res = await permisoApi.certificado(id);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `certificado_permiso_${id}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al descargar certificado');
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

  const editFechaFin = useMemo(
    () => editFechaInicio ? addBusinessDays(editFechaInicio, editCantidadDias - 1, feriados) : '',
    [editFechaInicio, editCantidadDias, feriados]
  );

  const handleEditOpen = (p: Permiso) => {
    const fin = p.fecha_fin || p.fecha_inicio;
    setEditFechaInicio(p.fecha_inicio);
    setEditCantidadDias(countBusinessDays(p.fecha_inicio, fin));
    setEditTipoJornada(p.tipo_jornada);
    setEditMotivo(p.motivo);
    setEditError('');
    setEditModal({ permiso: p, open: true });
  };

  const handleEditSave = async () => {
    if (!editModal.permiso) return;
    if (isWeekend(editFechaInicio)) {
      setEditError('La fecha de inicio no puede ser fin de semana');
      return;
    }
    if (feriados.includes(editFechaInicio)) {
      setEditError('La fecha de inicio corresponde a un feriado y no es un día válido');
      return;
    }
    if (editCantidadDias < 1) {
      setEditError('La cantidad de días debe ser al menos 1');
      return;
    }
    setEditError('');
    try {
      await permisoApi.update(editModal.permiso.id, {
        fecha_inicio: editFechaInicio,
        fecha_fin: editFechaFin,
        tipo_jornada: editCantidadDias > 1 ? 'completa' : editTipoJornada,
        motivo: editMotivo,
      });
      toast({ message: 'Permiso actualizado correctamente', type: 'success' });
      setEditModal({ permiso: null, open: false });
      load();
    } catch (err: any) {
      setEditError(err.response?.data?.message || 'Error al editar permiso');
    }
  };

  const limpiarFiltros = () => {
    setSearchTerm('');
    setFechaInicio('');
    setFechaFin('');
  };

  const renderComprobanteActions = (row: Permiso) => {
    if (row.estado !== 'aprobado') return null;
    if (row.comprobante_disponible) {
      return (
        <div className="flex gap-2">
          <button onClick={() => handleDescargarComprobante(row.id)} className="inline-flex items-center gap-1 text-sm text-green-600 hover:text-green-800">
            <FileText className="w-3.5 h-3.5" /> Ver
          </button>
          {puedeEditar && (
            <button onClick={() => handleUploadClick(row.id)} className="inline-flex items-center gap-1 text-sm text-amber-600 hover:text-amber-800">
              <Upload className="w-3.5 h-3.5" /> Cambiar
            </button>
          )}
        </div>
      );
    }
    if (puedeEditar) {
      return (
        <button onClick={() => handleUploadClick(row.id)} className="inline-flex items-center gap-1 text-sm text-amber-600 hover:text-amber-800">
          <Upload className="w-3.5 h-3.5" /> {row.comprobante_url ? 'Reintentar' : 'Cargar'}
        </button>
      );
    }
    return (
      <span className="text-xs text-red-500">
        {row.comprobante_url ? 'Comprobante no disponible' : 'Sin comprobante'}
      </span>
    );
  };

  const estadoBadge = (estado: string) => {
    const colors: Record<string, string> = {
      en_revision: 'bg-warning-100 text-warning-800',
      aprobado: 'bg-success-100 text-success-800',
      rechazado: 'bg-danger-100 text-danger-800',
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
    { key: 'fecha_fin', label: 'Fin', render: (v: string) => v ? formatDate(v) : '-' },
    { 
      key: 'dias', 
      label: 'Días', 
      render: (_: any, row: Permiso) => {
        const dias = calcularDias(row.fecha_inicio, row.fecha_fin, row.tipo_jornada);
        return (
          <span className="font-semibold text-primary-700">
            {dias} {dias === 1 ? 'día' : 'días'}
          </span>
        );
      }
    },
    { key: 'tipo_jornada', label: 'Jornada', render: (v: string) => v === 'completa' ? 'Completa' : 'Media' },
    { key: 'estado', label: 'Estado', render: (_: any, row: Permiso) => estadoBadge(row.estado) },
    { key: 'motivo', label: 'Motivo' },
    {
      key: 'certificado', label: 'Certificado', render: (_: any, row: Permiso) =>
        row.estado === 'aprobado' ? (
          <button onClick={() => handleDescargarCertificado(row.id)} className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800">
            <FileText className="w-3.5 h-3.5" /> Descargar
          </button>
        ) : null,
    },
    {
      key: 'comprobante', label: 'Comprobante', render: (_: any, row: Permiso) => renderComprobanteActions(row),
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Gestión de Permisos</h1>

      <div className="bg-white rounded-lg shadow p-4 mb-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Search className="inline w-4 h-4 mr-1" />
              Buscar Funcionario
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Nombre o RUT..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="inline w-4 h-4 mr-1" />
              Fecha Inicio
            </label>
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="inline w-4 h-4 mr-1" />
              Fecha Fin
            </label>
            <input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
          </div>
        </div>

        {(searchTerm || fechaInicio || fechaFin) && (
          <div className="flex items-center justify-between bg-primary-50 border border-primary-200 rounded-lg p-3">
            <p className="text-sm text-primary-800">
              Mostrando <span className="font-semibold">{permisosFiltrados.length}</span> de <span className="font-semibold">{permisos.length}</span> permisos
            </p>
            <button
              onClick={limpiarFiltros}
              className="inline-flex items-center gap-1 text-sm text-primary-700 hover:text-primary-900 font-medium"
            >
              <X className="w-4 h-4" /> Limpiar filtros
            </button>
          </div>
        )}
      </div>

      <DataTable
        columns={columns}
        data={permisosFiltrados}
        onEdit={handleEditOpen}
        canEdit={(row) => row.estado === 'en_revision'}
        onDelete={(row) => handleDelete(row.id)}
      />

      {permisosFiltrados.map((p) => (
        <MobileCard key={p.id} onDelete={() => handleDelete(p.id)}>
          <p className="font-medium">{p.nombres} {p.apellido_paterno}</p>
          <p className="text-sm text-gray-500">{p.rut}-{p.dv}</p>
          <p className="text-sm">{formatDate(p.fecha_inicio)}{p.fecha_fin ? ` - ${formatDate(p.fecha_fin)}` : ''}</p>
          <p className="text-sm font-semibold text-primary-700">
            {calcularDias(p.fecha_inicio, p.fecha_fin, p.tipo_jornada)} días
          </p>
          <div className="flex items-center gap-2">
            {estadoBadge(p.estado)}
            <span className="text-xs text-gray-500">{p.tipo_jornada === 'completa' ? 'Completa' : 'Media'}</span>
          </div>
          <p className="text-sm text-gray-600">{p.motivo}</p>
          {p.estado === 'en_revision' && (
            <div className="flex gap-2 mt-2">
              <button onClick={() => handleEditOpen(p)} className="inline-flex items-center gap-1 text-sm px-3 py-1 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
                <Pencil className="w-3.5 h-3.5" /> Editar
              </button>
              <button onClick={() => handleAprobar(p.id)} className="inline-flex items-center gap-1 text-sm px-3 py-1 bg-success-600 text-white rounded-lg hover:bg-success-700">
                <CheckCircle className="w-3.5 h-3.5" /> Aprobar
              </button>
              <button onClick={() => setRechazoModal({ id: p.id, open: true })} className="inline-flex items-center gap-1 text-sm px-3 py-1 bg-danger-600 text-white rounded-lg hover:bg-danger-700">
                <XCircle className="w-3.5 h-3.5" /> Rechazar
              </button>
            </div>
          )}
          {p.estado === 'aprobado' && (
            <div className="flex gap-2 mt-2">
              <button onClick={() => handleDescargarCertificado(p.id)} className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800">
                <FileText className="w-3.5 h-3.5" /> Certificado
              </button>
              {renderComprobanteActions(p)}
            </div>
          )}
        </MobileCard>
      ))}

      {permisosFiltrados.length > 0 && (
        <div className="hidden md:block">
          {permisosFiltrados.filter(p => p.estado === 'en_revision').length > 0 && (
            <div className="mt-4 space-y-2">
              <h2 className="font-semibold text-gray-700 mb-2">Acciones Pendientes</h2>
              <div className="grid gap-2">
                {permisosFiltrados.filter(p => p.estado === 'en_revision').map((p) => (
                  <div key={p.id} className="bg-white rounded-lg shadow p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium">{p.nombres} {p.apellido_paterno}</p>
                      <p className="text-sm text-gray-500">
                        {formatDate(p.fecha_inicio)} - {calcularDias(p.fecha_inicio, p.fecha_fin, p.tipo_jornada)} días - {p.motivo}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleAprobar(p.id)} className="inline-flex items-center gap-1 px-3 py-1 bg-success-600 text-white rounded-lg text-sm hover:bg-success-700"><CheckCircle className="w-3.5 h-3.5" /> Aprobar</button>
                      <button onClick={() => setRechazoModal({ id: p.id, open: true })} className="inline-flex items-center gap-1 px-3 py-1 bg-danger-600 text-white rounded-lg text-sm hover:bg-danger-700"><XCircle className="w-3.5 h-3.5" /> Rechazar</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <input
        type="file"
        ref={fileInputRef}
        accept=".pdf,.png,.jpg,.jpeg,.gif"
        onChange={handleFileSelected}
        className="hidden"
      />

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
          <button onClick={handleRechazar} className="flex items-center justify-center gap-2 w-full py-2 bg-danger-600 hover:bg-danger-700 text-white rounded-lg">
            <XCircle className="w-4 h-4" /> Rechazar Permiso
          </button>
        </div>
      </Modal>

      <Modal isOpen={editModal.open} onClose={() => setEditModal({ permiso: null, open: false })} title="Editar Permiso">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Trabajador</label>
            <div className="px-4 py-2 border rounded-lg bg-gray-50 text-sm text-gray-700">
              {editModal.permiso?.nombres} {editModal.permiso?.apellido_paterno}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Inicio</label>
            <input
              type="date"
              value={editFechaInicio}
              onChange={(e) => { setEditFechaInicio(e.target.value); setEditError(''); }}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none ${(isWeekend(editFechaInicio) || feriados.includes(editFechaInicio)) ? 'border-red-500' : ''}`}
              required
            />
            {isWeekend(editFechaInicio) && <p className="text-red-500 text-xs mt-1">La fecha de inicio no puede ser fin de semana</p>}
            {!isWeekend(editFechaInicio) && feriados.includes(editFechaInicio) && <p className="text-red-500 text-xs mt-1">La fecha de inicio corresponde a un feriado</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad de Días</label>
            <input
              type="number"
              min={1}
              max={6}
              value={editCantidadDias}
              onChange={(e) => setEditCantidadDias(Math.min(6, Math.max(1, parseInt(e.target.value) || 1)))}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Fin</label>
            <input
              type="date"
              value={editFechaFin}
              readOnly
              className="w-full px-4 py-2 border rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
            />
          </div>

          {editCantidadDias === 1 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Jornada</label>
              <select
                value={editTipoJornada}
                onChange={(e) => setEditTipoJornada(e.target.value as 'completa' | 'media')}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="completa">Jornada Completa</option>
                <option value="media">Media Jornada</option>
              </select>
            </div>
          )}

          {editCantidadDias > 1 && (
            <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-lg text-sm">
              Para permisos de múltiples días, la jornada será completa.
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Motivo</label>
            <textarea
              value={editMotivo}
              onChange={(e) => setEditMotivo(e.target.value)}
              rows={4}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              required
            />
          </div>

          {editError && <div className="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm">{editError}</div>}

          <button onClick={handleEditSave} className="flex items-center justify-center gap-2 w-full py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg">
            <Pencil className="w-4 h-4" /> Guardar Cambios
          </button>
        </div>
      </Modal>
    </div>
  );
}
