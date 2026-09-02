import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { permisoApi, feriadoApi } from '../services/api';
import { Permiso } from '../types';
import { DataTable } from '../components/DataTable';
import { MobileCard } from '../components/MobileCard';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { Modal } from '../components/Modal';
import { toast } from '../components/Toast';
import { CheckCircle, XCircle, Trash2, FileText, Search, Calendar, X, Upload, Pencil, Download, FileSpreadsheet, ChevronDown, ChevronUp } from 'lucide-react';
import { formatDate } from '../utils/format';
import { isWeekend, addBusinessDays } from '../utils/dates';

const calcularDias = (fechaInicio: string, fechaFin: string | null | undefined, tipoJornada: string, feriados: string[] = []): number => {
  const set = new Set(feriados);
  const d1 = new Date((fechaFin || fechaInicio) ? (fechaInicio + 'T12:00:00') : '');
  const d2 = new Date(((fechaFin || fechaInicio) + 'T12:00:00'));
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return tipoJornada === 'media' ? 0.5 : 1;
  let count = 0;
  const cur = new Date(d1);
  const end = new Date(d2);
  while (cur <= end) {
    const iso = cur.toISOString().split('T')[0];
    if (cur.getDay() !== 0 && cur.getDay() !== 6 && !set.has(iso)) count++;
    cur.setDate(cur.getDate() + 1);
  }
  if (count === 0) count = 1;
  return tipoJornada === 'media' ? count * 0.5 : count;
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
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; errors: Array<{ fila: number; message: string }>; total: number } | null>(null);
  const [importCollapsed, setImportCollapsed] = useState(true);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<{ preview: Array<{ fila: number; rut: string; fecha_inicio: string; fecha_fin: string; cantidad_dias: string; tipo_jornada: string; motivo: string; error: string | null; valido: boolean }>; errors: Array<{ fila: number; message: string }>; total: number } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

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

  const handleDescargarPlantilla = async () => {
    try {
      const res = await permisoApi.descargarPlantillaImport();
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'plantilla_permisos_administrativos.xlsx';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      if (err.response?.status === 403) toast({ message: 'No tienes permisos para descargar la plantilla', type: 'error' });
      else toast({ message: err.response?.data?.message || 'Error al descargar plantilla', type: 'error' });
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreviewFile(file);
    setPreviewData(null);
    setImportResult(null);
    setPreviewLoading(true);
    if (importCollapsed) setImportCollapsed(false);
    try {
      const res = await permisoApi.previsualizarPlanilla(file);
      setPreviewData(res.data);
      if (res.data.errors.length) toast({ message: `${res.data.errors.length} filas con errores en previsualización`, type: 'error' });
      else toast({ message: `${res.data.total} filas listas para importar`, type: 'success' });
    } catch (err: any) {
      if (err.response?.status === 403) toast({ message: err.response?.data?.message || 'No tienes permisos para previsualizar', type: 'error' });
      else toast({ message: err.response?.data?.message || 'Error al previsualizar planilla', type: 'error' });
    } finally {
      setPreviewLoading(false);
      if (importInputRef.current) importInputRef.current.value = '';
    }
  };

  const handleConfirmImport = async () => {
    if (!previewFile) { toast({ message: 'Debe seleccionar un archivo primero', type: 'error' }); return; }
    if (previewData && previewData.errors.length > 0 && !confirm(`Hay ${previewData.errors.length} filas con errores que serán omitidas. ¿Continuar con la importación de las filas válidas?`)) return;
    setImportLoading(true);
    try {
      const res = await permisoApi.importarPlanilla(previewFile);
      setImportResult(res.data);
      toast({ message: `Importación completa: ${res.data.created} creados, ${res.data.errors.length} errores`, type: res.data.errors.length ? 'error' : 'success' });
      setPreviewData(null);
      setPreviewFile(null);
      load();
    } catch (err: any) {
      if (err.response?.status === 403) toast({ message: err.response?.data?.message || 'No tienes permisos para importar', type: 'error' });
      else toast({ message: err.response?.data?.message || 'Error al importar planilla', type: 'error' });
    } finally { setImportLoading(false); }
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
        const dias = calcularDias(row.fecha_inicio, row.fecha_fin, row.tipo_jornada, feriados);
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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Gestión de Permisos</h1>
        <div className="flex gap-2">
          <button onClick={handleDescargarPlantilla} className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
            <Download className="w-4 h-4" /> Descargar plantilla
          </button>
          <button onClick={() => importInputRef.current?.click()} disabled={importLoading} className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">
            <FileSpreadsheet className="w-4 h-4" /> {importLoading ? 'Importando...' : 'Cargar planilla'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow mb-6 overflow-hidden">
        <button onClick={() => setImportCollapsed((v) => !v)} className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50">
          <span className="text-sm font-semibold text-gray-800 flex items-center gap-2"><FileSpreadsheet className="w-4 h-4 text-primary-600" /> Carga masiva por planilla</span>
          {importCollapsed ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronUp className="w-4 h-4 text-gray-500" />}
        </button>
        {!importCollapsed && (
          <div className="px-4 pb-4 space-y-3 border-t pt-3">
            <p className="text-xs text-gray-600">Sube un archivo Excel con múltiples permisos. Descarga primero la plantilla, complétala y luego cárgala. La segunda hoja <span className="font-medium">Instrucciones</span> detalla cada campo. La relación es <span className="font-mono">permisos_administrativos.user_id → users.id</span> y se resuelve por <span className="font-medium">RUT+DV</span>.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-2 py-1.5 text-left border">Campo</th>
                    <th className="px-2 py-1.5 text-left border">Requerido</th>
                    <th className="px-2 py-1.5 text-left border">Formato / Valores</th>
                    <th className="px-2 py-1.5 text-left border">Ejemplo</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td className="px-2 py-1 border font-medium">rut</td><td className="px-2 py-1 border">Sí</td><td className="px-2 py-1 border">Números y K, sin puntos ni guion</td><td className="px-2 py-1 border">12345678</td></tr>
                  <tr><td className="px-2 py-1 border font-medium">dv</td><td className="px-2 py-1 border">Sí</td><td className="px-2 py-1 border">0-9 o K</td><td className="px-2 py-1 border">5</td></tr>
                  <tr><td className="px-2 py-1 border font-medium">fecha_inicio</td><td className="px-2 py-1 border">Sí</td><td className="px-2 py-1 border">YYYY-MM-DD, no finde semana/feriado</td><td className="px-2 py-1 border">2026-03-02</td></tr>
                  <tr><td className="px-2 py-1 border font-medium">cantidad_dias</td><td className="px-2 py-1 border">Sí</td><td className="px-2 py-1 border">1 a 6 — fecha_fin se calcula sola (días hábiles)</td><td className="px-2 py-1 border">2</td></tr>
                  <tr><td className="px-2 py-1 border font-medium">tipo_jornada</td><td className="px-2 py-1 border">Sí</td><td className="px-2 py-1 border">completa | media (media solo si cantidad=1)</td><td className="px-2 py-1 border">completa</td></tr>
                  <tr><td className="px-2 py-1 border font-medium">motivo</td><td className="px-2 py-1 border">Sí</td><td className="px-2 py-1 border">Texto libre</td><td className="px-2 py-1 border">Trámite personal</td></tr>
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-gray-500">La <span className="font-medium">fecha_fin se calcula automáticamente</span> a partir de fecha_inicio + (cantidad_dias - 1) días hábiles, saltando fines de semana y feriados.</p>
            {previewLoading && <p className="text-xs text-gray-500">Previsualizando planilla...</p>}
            {previewData && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-gray-700">Previsualización: {previewData.total} filas — <span className="text-green-600">{previewData.preview.filter((r) => r.valido).length} válidas</span> / <span className="text-red-600">{previewData.errors.length} con errores</span></p>
                  <div className="flex gap-2">
                    <button onClick={() => { setPreviewData(null); setPreviewFile(null); }} className="px-3 py-1 text-xs border rounded-lg hover:bg-gray-50">Descartar</button>
                    <button onClick={handleConfirmImport} disabled={importLoading || previewData.preview.filter((r) => r.valido).length === 0} className="px-4 py-1.5 text-xs bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">{importLoading ? 'Importando...' : 'Confirmar importación'}</button>
                  </div>
                </div>
                <div className="overflow-auto max-h-80 border rounded-lg">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-2 py-1.5 text-left border-b">Fila</th>
                        <th className="px-2 py-1.5 text-left border-b">RUT</th>
                        <th className="px-2 py-1.5 text-left border-b">Inicio</th>
                        <th className="px-2 py-1.5 text-left border-b">Días</th>
                        <th className="px-2 py-1.5 text-left border-b">Fin calc.</th>
                        <th className="px-2 py-1.5 text-left border-b">Jornada</th>
                        <th className="px-2 py-1.5 text-left border-b">Motivo</th>
                        <th className="px-2 py-1.5 text-left border-b">Estado / Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.preview.map((r) => (
                        <tr key={r.fila} className={r.valido ? 'bg-white' : 'bg-red-50'}>
                          <td className="px-2 py-1 border-b">{r.fila}</td>
                          <td className="px-2 py-1 border-b font-mono">{r.rut}</td>
                          <td className="px-2 py-1 border-b">{r.fecha_inicio}</td>
                          <td className="px-2 py-1 border-b text-center">{r.cantidad_dias}</td>
                          <td className="px-2 py-1 border-b">{r.fecha_fin}</td>
                          <td className="px-2 py-1 border-b">{r.tipo_jornada}</td>
                          <td className="px-2 py-1 border-b max-w-[180px] truncate" title={r.motivo}>{r.motivo}</td>
                          <td className="px-2 py-1 border-b">{r.valido ? <span className="text-green-600 font-medium">✓ Válido</span> : <span className="text-red-600">{r.error}</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {importResult && (
              <div className={`rounded-lg p-3 text-sm ${importResult.errors.length ? 'bg-amber-50 border border-amber-200' : 'bg-green-50 border border-green-200'}`}>
                <p className={importResult.errors.length ? 'text-amber-800' : 'text-green-800'}>
                  Resultado: <span className="font-semibold">{importResult.created}</span> creados de <span className="font-semibold">{importResult.total}</span> filas.
                  {importResult.errors.length > 0 && ` ${importResult.errors.length} con errores.`}
                </p>
                {importResult.errors.length > 0 && (
                  <ul className="mt-2 max-h-40 overflow-auto text-xs space-y-1">
                    {importResult.errors.map((e, i) => (
                      <li key={i} className="text-red-700">Fila {e.fila}: {e.message}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <input type="file" ref={importInputRef} accept=".xlsx,.xls" onChange={handleImportFile} className="hidden" />

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
            {calcularDias(p.fecha_inicio, p.fecha_fin, p.tipo_jornada, feriados)} días
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
                        {formatDate(p.fecha_inicio)} - {calcularDias(p.fecha_inicio, p.fecha_fin, p.tipo_jornada, feriados)} días - {p.motivo}
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
