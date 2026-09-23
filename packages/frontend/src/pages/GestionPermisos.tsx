import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { permisoApi, matrimonioApi, feriadoApi } from '../services/api';
import { Permiso, PermisoMatrimonio } from '../types';
import { DataTable } from '../components/DataTable';
import { MobileCard } from '../components/MobileCard';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { Modal } from '../components/Modal';
import { toast } from '../components/Toast';
import { CheckCircle, XCircle, FileText, Search, Calendar, X, Upload, Pencil, Download, FileSpreadsheet, ChevronDown, ChevronUp, Loader2, Heart } from 'lucide-react';
import { formatDate } from '../utils/format';
import { isWeekend, addBusinessDays } from '../utils/dates';

type TipoFiltro = 'todos' | 'administrativo' | 'matrimonio';
type Row = (Permiso & { _tipo: 'administrativo' }) | (PermisoMatrimonio & { _tipo: 'matrimonio'; tipo_jornada: 'completa' });

const calcularDias = (fechaInicio: string, fechaFin: string | null | undefined, tipoJornada: string, feriados: string[] = []): number => {
  const set = new Set(feriados);
  const d1 = new Date(fechaInicio + 'T12:00:00');
  const d2 = new Date((fechaFin || fechaInicio) + 'T12:00:00');
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return tipoJornada === 'media' ? 0.5 : 1;
  let count = 0; const cur = new Date(d1); const end = new Date(d2);
  while (cur <= end) { const iso = cur.toISOString().split('T')[0]; if (cur.getDay() !== 0 && cur.getDay() !== 6 && !set.has(iso)) count++; cur.setDate(cur.getDate() + 1); }
  if (count === 0) count = 1; return tipoJornada === 'media' ? Math.max(0.5, count - 0.5) : count;
};

export default function GestionPermisos() {
  const { user } = useAuth();
  const [permisos, setPermisos] = useState<Permiso[]>([]);
  const [matrimonios, setMatrimonios] = useState<PermisoMatrimonio[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState<TipoFiltro>('todos');
  const [rechazoModal, setRechazoModal] = useState<{ id: number; tipo: TipoFiltro; open: boolean }>({ id: 0, tipo: 'administrativo', open: false });
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; errors: Array<{ fila: number; message: string }>; total: number } | null>(null);
  const [importCollapsed, setImportCollapsed] = useState(true);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [importEstado, setImportEstado] = useState<'en_revision' | 'aprobado'>('en_revision');
  const [previewData, setPreviewData] = useState<{ preview: Array<{ fila: number; rut: string; fecha_inicio: string; fecha_fin: string; cantidad_dias: string; tipo_jornada: string; motivo: string; error: string | null; valido: boolean }>; errors: Array<{ fila: number; message: string }>; total: number } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editModal, setEditModal] = useState<{ row: Row | null; open: boolean }>({ row: null, open: false });
  const [editFechaInicio, setEditFechaInicio] = useState('');
  const [editCantidadDias, setEditCantidadDias] = useState(1);
  const [editMotivo, setEditMotivo] = useState('');
  const [editError, setEditError] = useState('');
  const [feriados, setFeriados] = useState<string[]>([]);
  const puedeEditar = user?.rolId === 1 || user?.rolId === 2;
  const puedeAprobar = user?.permissions?.some((p) => p.seccion === 'permisos_administrativos' && p.can_approve) || user?.rolId === 1 || user?.rolId === 2;

  useEffect(() => { feriadoApi.list(new Date().getFullYear()).then((res) => setFeriados(res.data.map((f: any) => f.fecha))).catch(() => {}); }, []);
  const load = () => {
    setLoading(true);
    Promise.all([permisoApi.listarTodos(), matrimonioApi.listarTodos().catch(() => ({ data: [] }))])
      .then(([rA, rM]) => { setPermisos(rA.data); setMatrimonios(Array.isArray(rM.data) ? rM.data : []); })
      .catch(console.error).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const unificados: Row[] = useMemo(() => {
    const a: Row[] = permisos.map((p) => ({ ...p, _tipo: 'administrativo' as const }));
    const m: Row[] = matrimonios.map((p) => ({ ...p, _tipo: 'matrimonio' as const, tipo_jornada: 'completa' as const }));
    return [...a, ...m].sort((x, y) => new Date(y.fecha_solicitud).getTime() - new Date(x.fecha_solicitud).getTime());
  }, [permisos, matrimonios]);

  const permisosFiltrados = useMemo(() => unificados.filter((p) => {
    if (filtroTipo !== 'todos' && p._tipo !== filtroTipo) return false;
    const nombreCompleto = `${(p as any).nombres} ${(p as any).apellido_paterno}`.toLowerCase();
    const rut = `${(p as any).rut}${(p as any).dv}`.toLowerCase();
    const searchMatch = searchTerm === '' || nombreCompleto.includes(searchTerm.toLowerCase()) || rut.includes(searchTerm.toLowerCase());
    let dateMatch = true;
    if (fechaInicio || fechaFin) {
      const permisoInicio = new Date(p.fecha_inicio);
      const permisoFin = p.fecha_fin ? new Date(p.fecha_fin) : permisoInicio;
      if (fechaInicio) { const fI = new Date(fechaInicio); dateMatch = dateMatch && (permisoFin >= fI); }
      if (fechaFin) { const fF = new Date(fechaFin); dateMatch = dateMatch && (permisoInicio <= fF); }
    }
    return searchMatch && dateMatch;
  }), [unificados, searchTerm, fechaInicio, fechaFin, filtroTipo]);

  const handleAprobar = async (row: Row) => {
    if (!confirm(`¿Aprobar este permiso ${row._tipo === 'matrimonio' ? 'por matrimonio' : 'administrativo'}?`)) return;
    const key = `${row._tipo}-${row.id}`; setApprovingId(key);
    try {
      if (row._tipo === 'matrimonio') await matrimonioApi.aprobar(row.id); else await permisoApi.aprobar(row.id);
      toast({ message: 'Permiso aprobado', type: 'success' }); load();
    } catch (err: any) { toast({ message: err.response?.data?.message || 'Error al aprobar', type: 'error' }); } finally { setApprovingId(null); }
  };
  const handleRechazar = async () => {
    if (!motivoRechazo.trim()) { toast({ message: 'Debe ingresar motivo de rechazo', type: 'error' }); return; }
    setRejecting(true);
    try {
      if (rechazoModal.tipo === 'matrimonio') await matrimonioApi.rechazar(rechazoModal.id, motivoRechazo); else await permisoApi.rechazar(rechazoModal.id, motivoRechazo);
      toast({ message: 'Permiso rechazado', type: 'success' }); setRechazoModal({ id: 0, tipo: 'administrativo', open: false }); setMotivoRechazo(''); load();
    } catch (err: any) { toast({ message: err.response?.data?.message || 'Error al rechazar', type: 'error' }); } finally { setRejecting(false); }
  };
  const handleDelete = async (row: Row) => {
    if (!confirm('¿Eliminar este permiso?')) return;
    const key = `${row._tipo}-${row.id}`; setDeletingId(key);
    try {
      if (row._tipo === 'matrimonio') await matrimonioApi.delete(row.id); else await permisoApi.delete(row.id);
      toast({ message: 'Permiso eliminado', type: 'success' }); load();
    } catch (err: any) { toast({ message: err.response?.data?.message || 'Error al eliminar', type: 'error' }); } finally { setDeletingId(null); }
  };
  const handleUploadClick = (row: Row) => { setUploadingId(`${row._tipo}-${row.id}`); fileInputRef.current?.click(); const onFocus = () => { setTimeout(() => { if (fileInputRef.current && !fileInputRef.current.value) setUploadingId(null); window.removeEventListener('focus', onFocus); }, 300); }; window.addEventListener('focus', onFocus); };
  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !uploadingId) return;
    setUploading(true);
    try {
      const [tipo, idStr] = uploadingId.split('-'); const id = parseInt(idStr);
      if (tipo === 'matrimonio') await matrimonioApi.subirComprobante(id, file); else await permisoApi.subirComprobante(id, file);
      toast({ message: 'Comprobante subido correctamente', type: 'success' }); load();
    } catch (err: any) { toast({ message: err.response?.data?.message || 'Error al subir comprobante', type: 'error' }); }
    finally { setUploading(false); setUploadingId(null); if (fileInputRef.current) fileInputRef.current.value = ''; }
  };
  const handleDescargarComprobante = async (row: Row) => {
    try { const res = row._tipo === 'matrimonio' ? await matrimonioApi.descargarComprobante(row.id) : await permisoApi.descargarComprobante(row.id); const ct = String(res.headers['content-type'] || ''); const ext = ct.includes('pdf') ? '.pdf' : ct.includes('png') ? '.png' : '.jpg'; const url = window.URL.createObjectURL(new Blob([res.data])); const a = document.createElement('a'); a.href = url; a.download = `comprobante_${row._tipo}_${row.id}${ext}`; a.click(); window.URL.revokeObjectURL(url); } catch (err: any) { alert(err.response?.data?.message || 'Error al descargar comprobante'); }
  };
  const handleDescargarCertificado = async (id: number) => {
    try { const res = await permisoApi.certificado(id); const url = window.URL.createObjectURL(new Blob([res.data])); const a = document.createElement('a'); a.href = url; a.download = `certificado_permiso_${id}.pdf`; a.click(); window.URL.revokeObjectURL(url); } catch (err: any) { alert(err.response?.data?.message || 'Error al descargar certificado'); }
  };
  const handleGenerarComprobanteMatrimonio = async (id: number) => {
    try { const res = await matrimonioApi.comprobantePdf(id); const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' })); const a = document.createElement('a'); a.href = url; a.download = `comprobante_matrimonio_${id}.pdf`; a.click(); window.URL.revokeObjectURL(url); } catch (err: any) { alert(err.response?.data?.message || 'Error al generar comprobante'); }
  };
  const handleDescargarPlantilla = async () => {
    try { const res = await permisoApi.descargarPlantillaImport(); const url = window.URL.createObjectURL(new Blob([res.data])); const a = document.createElement('a'); a.href = url; a.download = 'plantilla_permisos_administrativos.xlsx'; a.click(); window.URL.revokeObjectURL(url); } catch (err: any) { if (err.response?.status === 403) toast({ message: 'No tienes permisos para descargar la plantilla', type: 'error' }); else toast({ message: err.response?.data?.message || 'Error al descargar plantilla', type: 'error' }); }
  };
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setPreviewFile(file); setPreviewData(null); setImportResult(null); setPreviewLoading(true); if (importCollapsed) setImportCollapsed(false);
    try { const res = await permisoApi.previsualizarPlanilla(file); setPreviewData(res.data); if (res.data.errors.length) toast({ message: `${res.data.errors.length} filas con errores`, type: 'error' }); else toast({ message: `${res.data.total} filas listas`, type: 'success' }); } catch (err: any) { toast({ message: err.response?.data?.message || 'Error al previsualizar planilla', type: 'error' }); } finally { setPreviewLoading(false); if (importInputRef.current) importInputRef.current.value = ''; }
  };
  const handleConfirmImport = async () => {
    if (!previewFile) { toast({ message: 'Debe seleccionar un archivo primero', type: 'error' }); return; }
    if (previewData && previewData.errors.length > 0 && !confirm(`Hay ${previewData.errors.length} filas con errores que serán omitidas. ¿Continuar?`)) return;
    setImportLoading(true);
    try { const res = await permisoApi.importarPlanilla(previewFile, importEstado); setImportResult(res.data); toast({ message: `Importación: ${res.data.created} creados, ${res.data.errors.length} errores`, type: res.data.errors.length ? 'error' : 'success' }); setPreviewData(null); setPreviewFile(null); load(); } catch (err: any) { toast({ message: err.response?.data?.message || 'Error al importar', type: 'error' }); } finally { setImportLoading(false); }
  };

  const editFechaFin = useMemo(() => {
    if (!editModal.row) return '';
    if (editModal.row._tipo === 'matrimonio') return editFechaInicio ? addBusinessDays(editFechaInicio, 4, feriados) : '';
    return editFechaInicio ? addBusinessDays(editFechaInicio, Math.ceil(editCantidadDias) - 1, feriados) : '';
  }, [editFechaInicio, editCantidadDias, feriados, editModal.row]);

  const handleEditOpen = (row: Row) => {
    setEditFechaInicio(row.fecha_inicio);
    if (row._tipo === 'matrimonio') setEditCantidadDias(5);
    else { const dias = calcularDias(row.fecha_inicio, (row as Permiso).fecha_fin, (row as Permiso).tipo_jornada || 'completa', feriados); setEditCantidadDias(dias); }
    setEditMotivo(row.motivo); setEditError(''); setEditModal({ row, open: true });
  };
  const handleEditSave = async () => {
    if (!editModal.row) return;
    if (isWeekend(editFechaInicio)) { setEditError('La fecha de inicio no puede ser fin de semana'); return; }
    if (feriados.includes(editFechaInicio)) { setEditError('La fecha de inicio corresponde a un feriado'); return; }
    if (editModal.row._tipo !== 'matrimonio' && (isWeekend(editFechaFin) || feriados.includes(editFechaFin))) { setEditError('La fecha de término calculada cae en fin de semana/feriado, elige otra fecha de inicio'); return; }
    setSavingEdit(true);
    try {
      if (editModal.row._tipo === 'matrimonio') {
        await matrimonioApi.update(editModal.row.id, { fecha_inicio: editFechaInicio, fecha_fin: editFechaFin, motivo: editMotivo });
      } else {
        const tipoJornadaDerivada = Number.isInteger(editCantidadDias) ? 'completa' as const : 'media' as const;
        await permisoApi.update(editModal.row.id, { fecha_inicio: editFechaInicio, fecha_fin: editFechaFin, tipo_jornada: tipoJornadaDerivada, motivo: editMotivo });
      }
      toast({ message: 'Permiso actualizado correctamente', type: 'success' }); setEditModal({ row: null, open: false }); load();
    } catch (err: any) { setEditError(err.response?.data?.message || 'Error al editar permiso'); } finally { setSavingEdit(false); }
  };

  const limpiarFiltros = () => { setSearchTerm(''); setFechaInicio(''); setFechaFin(''); };
  const tipoBadge = (t: string) => t === 'matrimonio' ? <span className="px-2 py-1 rounded-full text-xs font-medium bg-pink-100 text-pink-800 inline-flex items-center gap-1"><Heart className="w-3 h-3" /> Matrimonio</span> : <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Administrativo</span>;
  const estadoBadge = (estado: string) => {
    const colors: Record<string, string> = { en_revision: 'bg-warning-100 text-warning-800', aprobado: 'bg-success-100 text-success-800', rechazado: 'bg-danger-100 text-danger-800' };
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[estado] || 'bg-gray-100'}`}>{estado === 'en_revision' ? 'En Revisión' : estado === 'aprobado' ? 'Aprobado' : 'Rechazado'}</span>;
  };
  const isProcessing = approvingId !== null || rejecting || deletingId !== null || savingEdit || uploading || importLoading || previewLoading;
  const [showProcessing, setShowProcessing] = useState(false);
  useEffect(() => { let t: any; if (isProcessing) setShowProcessing(true); else t = setTimeout(() => setShowProcessing(false), 500); return () => clearTimeout(t); }, [isProcessing]);
  const renderComprobanteActions = (row: Row) => {
    if (row.estado !== 'aprobado') return null;
    if (row.comprobante_disponible) {
      return <div className="flex gap-2"><button onClick={() => handleDescargarComprobante(row)} className="inline-flex items-center gap-1 text-sm text-green-600 hover:text-green-800"><FileText className="w-3.5 h-3.5" /> Ver</button>{puedeEditar && <button onClick={() => handleUploadClick(row)} className="inline-flex items-center gap-1 text-sm text-amber-600 hover:text-amber-800"><Upload className="w-3.5 h-3.5" /> Cambiar</button>}</div>;
    }
    if (puedeEditar) return <button onClick={() => handleUploadClick(row)} className="inline-flex items-center gap-1 text-sm text-amber-600 hover:text-amber-800"><Upload className="w-3.5 h-3.5" /> {row.comprobante_url ? 'Reintentar' : 'Cargar'}</button>;
    return <span className="text-xs text-red-500">{row.comprobante_url ? 'Comprobante no disponible' : 'Sin comprobante'}</span>;
  };

  if (loading) return <LoadingSpinner message="Cargando permisos..." />;

  const columns = [
    { key: 'tipo', label: 'Tipo', render: (_: any, row: Row) => tipoBadge(row._tipo) },
    { key: 'nombres', label: 'Trabajador', render: (_: any, row: Row) => `${(row as any).nombres} ${(row as any).apellido_paterno}` },
    { key: 'rut', label: 'RUT', render: (_: any, row: Row) => `${(row as any).rut}-${(row as any).dv}` },
    { key: 'fecha_inicio', label: 'Inicio', render: (v: string) => formatDate(v) },
    { key: 'fecha_fin', label: 'Fin', render: (v: string) => v ? formatDate(v) : '-' },
    { key: 'dias', label: 'Días', render: (_: any, row: Row) => {
      const dias = row._tipo === 'matrimonio' ? 5 : calcularDias(row.fecha_inicio, (row as Permiso).fecha_fin, (row as Permiso).tipo_jornada || 'completa', feriados);
      return <span className={`font-semibold ${row._tipo === 'matrimonio' ? 'text-pink-700' : 'text-primary-700'}`}>{dias} {dias === 1 ? 'día' : 'días'}</span>;
    }},
    { key: 'tipo_jornada', label: 'Jornada', render: (v: string, row: Row) => row._tipo === 'matrimonio' ? '-' : v === 'completa' ? 'Completa' : 'Media' },
    { key: 'estado', label: 'Estado', render: (_: any, row: Row) => estadoBadge(row.estado) },
    { key: 'motivo', label: 'Motivo' },
    { key: 'certificado', label: 'Certificado / Comprobante', render: (_: any, row: Row) => {
      if (row.estado !== 'aprobado') return null;
      if (row._tipo === 'administrativo') return <button onClick={() => handleDescargarCertificado(row.id)} className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"><FileText className="w-3.5 h-3.5" /> Descargar</button>;
      return <button onClick={() => handleGenerarComprobanteMatrimonio(row.id)} className="inline-flex items-center gap-1 text-sm text-pink-600 hover:text-pink-800"><FileText className="w-3.5 h-3.5" /> Comprobante</button>;
    } },
    { key: 'comprobante', label: 'Comprobante', render: (_: any, row: Row) => renderComprobanteActions(row) },
  ];

  return (
    <div>
      {showProcessing && <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"><div className="bg-white rounded-lg px-8 py-6 flex flex-col items-center gap-3 shadow-xl"><Loader2 className="w-10 h-10 animate-spin text-primary-600" /><p className="text-sm font-medium text-gray-700">Procesando...</p></div></div>}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
        <h1 className="text-2xl font-bold text-gray-800">Gestión de Permisos</h1>
        <div className="flex gap-2">
          <button onClick={handleDescargarPlantilla} className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50"><Download className="w-4 h-4" /> Descargar plantilla</button>
          <button onClick={() => importInputRef.current?.click()} disabled={importLoading} className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50"><FileSpreadsheet className="w-4 h-4" /> {importLoading ? 'Importando...' : 'Cargar planilla'}</button>
        </div>
      </div>

      <div className="flex bg-gray-100 rounded-lg p-1 mb-4 w-fit">
        {(['todos', 'administrativo', 'matrimonio'] as TipoFiltro[]).map((t) => (
          <button key={t} onClick={() => setFiltroTipo(t)} className={`px-4 py-1.5 text-sm font-medium rounded-md capitalize ${filtroTipo === t ? 'bg-white shadow text-gray-800' : 'text-gray-600'}`}>{t === 'todos' ? 'Todos' : t === 'matrimonio' ? 'Matrimonio' : 'Administrativo'}</button>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow mb-6 overflow-hidden">
        <button onClick={() => setImportCollapsed((v) => !v)} className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50">
          <span className="text-sm font-semibold text-gray-800 flex items-center gap-2"><FileSpreadsheet className="w-4 h-4 text-primary-600" /> Carga masiva por planilla</span>
          {importCollapsed ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronUp className="w-4 h-4 text-gray-500" />}
        </button>
        {!importCollapsed && (
          <div className="px-4 pb-4 space-y-3 border-t pt-3">
            <p className="text-xs text-gray-600">Sube un archivo Excel con múltiples permisos administrativos. La planilla solo aplica a permisos administrativos (el permiso matrimonio debe registrarse individualmente).</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border"><thead className="bg-gray-50"><tr><th className="px-2 py-1.5 text-left border">Campo</th><th className="px-2 py-1.5 text-left border">Requerido</th><th className="px-2 py-1.5 text-left border">Formato</th><th className="px-2 py-1.5 text-left border">Ejemplo</th></tr></thead>
                <tbody><tr><td className="px-2 py-1 border font-medium">rut</td><td className="px-2 py-1 border">Sí</td><td className="px-2 py-1 border">Números y K, sin puntos ni guion</td><td className="px-2 py-1 border">12345678</td></tr><tr><td className="px-2 py-1 border font-medium">dv</td><td className="px-2 py-1 border">Sí</td><td className="px-2 py-1 border">0-9 o K</td><td className="px-2 py-1 border">5</td></tr><tr><td className="px-2 py-1 border font-medium">fecha_inicio</td><td className="px-2 py-1 border">Sí</td><td className="px-2 py-1 border">YYYY-MM-DD</td><td className="px-2 py-1 border">2026-03-02</td></tr><tr><td className="px-2 py-1 border font-medium">cantidad_dias</td><td className="px-2 py-1 border">Sí</td><td className="px-2 py-1 border">1 a 6, 0.5 o medio</td><td className="px-2 py-1 border">2</td></tr><tr><td className="px-2 py-1 border font-medium">tipo_jornada</td><td className="px-2 py-1 border">Sí</td><td className="px-2 py-1 border">completa | media</td><td className="px-2 py-1 border">completa</td></tr><tr><td className="px-2 py-1 border font-medium">motivo</td><td className="px-2 py-1 border">Sí</td><td className="px-2 py-1 border">Texto libre</td><td className="px-2 py-1 border">Trámite personal</td></tr></tbody>
              </table>
            </div>
            <p className="text-[11px] text-gray-500">La <span className="font-medium">fecha_fin se calcula automáticamente</span> a partir de fecha_inicio + (cantidad_dias - 1) días hábiles.</p>
            {previewLoading && <p className="text-xs text-gray-500">Previsualizando planilla...</p>}
            {previewData && (
              <div className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2"><p className="text-xs font-medium text-gray-700">Previsualización: {previewData.total} filas — <span className="text-green-600">{previewData.preview.filter((r) => r.valido).length} válidas</span> / <span className="text-red-600">{previewData.errors.length} con errores</span></p><div className="flex items-center gap-2"><label className="text-xs font-medium text-gray-600">Estado al importar:</label><select value={importEstado} onChange={(e) => setImportEstado(e.target.value as 'en_revision' | 'aprobado')} className="px-2 py-1.5 text-xs border rounded-lg bg-white"><option value="en_revision">En Revisión</option><option value="aprobado">Aprobado</option></select><button onClick={() => { setPreviewData(null); setPreviewFile(null); }} className="px-3 py-1 text-xs border rounded-lg hover:bg-gray-50">Descartar</button><button onClick={handleConfirmImport} disabled={importLoading || previewData.preview.filter((r) => r.valido).length === 0} className="px-4 py-1.5 text-xs bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">{importLoading ? 'Importando...' : 'Confirmar importación'}</button></div></div>
                <div className="overflow-auto max-h-80 border rounded-lg"><table className="w-full text-xs"><thead className="bg-gray-50 sticky top-0"><tr><th className="px-2 py-1.5 text-left border-b">Fila</th><th className="px-2 py-1.5 text-left border-b">RUT</th><th className="px-2 py-1.5 text-left border-b">Inicio</th><th className="px-2 py-1.5 text-left border-b">Días</th><th className="px-2 py-1.5 text-left border-b">Fin calc.</th><th className="px-2 py-1.5 text-left border-b">Jornada</th><th className="px-2 py-1.5 text-left border-b">Estado / Error</th></tr></thead><tbody>{previewData.preview.map((r) => <tr key={r.fila} className={r.valido ? 'bg-white' : 'bg-red-50'}><td className="px-2 py-1 border-b">{r.fila}</td><td className="px-2 py-1 border-b font-mono">{r.rut}</td><td className="px-2 py-1 border-b">{r.fecha_inicio}</td><td className="px-2 py-1 border-b text-center">{r.cantidad_dias}</td><td className="px-2 py-1 border-b">{r.fecha_fin}</td><td className="px-2 py-1 border-b">{r.tipo_jornada}</td><td className="px-2 py-1 border-b">{r.valido ? <span className="text-green-600 font-medium">✓ Válido</span> : <span className="text-red-600">{r.error}</span>}</td></tr>)}</tbody></table></div>
              </div>
            )}
            {importResult && <div className={`rounded-lg p-3 text-sm ${importResult.errors.length ? 'bg-amber-50 border border-amber-200' : 'bg-green-50 border border-green-200'}`}><p className={importResult.errors.length ? 'text-amber-800' : 'text-green-800'}>Resultado: <span className="font-semibold">{importResult.created}</span> creados de <span className="font-semibold">{importResult.total}</span> filas.</p>{importResult.errors.length > 0 && <ul className="mt-2 max-h-40 overflow-auto text-xs space-y-1">{importResult.errors.map((e, i) => <li key={i} className="text-red-700">Fila {e.fila}: {e.message}</li>)}</ul>}</div>}
          </div>
        )}
      </div>
      <input type="file" ref={importInputRef} accept=".xlsx,.xls" onChange={handleImportFile} className="hidden" />

      <div className="bg-white rounded-lg shadow p-4 mb-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div><label className="block text-sm font-medium mb-2"><Search className="inline w-4 h-4 mr-1" />Buscar Funcionario</label><input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Nombre o RUT..." className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-primary-500" /></div>
          <div><label className="block text-sm font-medium mb-2"><Calendar className="inline w-4 h-4 mr-1" />Fecha Inicio</label><input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} className="w-full px-4 py-2 border rounded-lg outline-none" /></div>
          <div><label className="block text-sm font-medium mb-2"><Calendar className="inline w-4 h-4 mr-1" />Fecha Fin</label><input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} className="w-full px-4 py-2 border rounded-lg outline-none" /></div>
        </div>
        {(searchTerm || fechaInicio || fechaFin) && <div className="flex items-center justify-between bg-primary-50 border border-primary-200 rounded-lg p-3"><p className="text-sm text-primary-800">Mostrando <span className="font-semibold">{permisosFiltrados.length}</span> de <span className="font-semibold">{unificados.length}</span> permisos</p><button onClick={limpiarFiltros} className="inline-flex items-center gap-1 text-sm text-primary-700 font-medium"><X className="w-4 h-4" /> Limpiar filtros</button></div>}
      </div>

      <DataTable columns={columns as any} data={permisosFiltrados as any} onApprove={(row: any) => handleAprobar(row as Row)} canApprove={(row: any) => (row as Row).estado === 'en_revision' && puedeAprobar} onEdit={(row: any) => handleEditOpen(row as Row)} canEdit={(row: any) => (row as Row).estado === 'en_revision'} onDelete={(row: any) => handleDelete(row as Row)} />
      {permisosFiltrados.map((p) => (
        <MobileCard key={`${p._tipo}-${p.id}`} onDelete={() => handleDelete(p)}>
          <p className="font-medium">{(p as any).nombres} {(p as any).apellido_paterno} {tipoBadge(p._tipo)}</p>
          <p className="text-sm text-gray-500">{(p as any).rut}-{(p as any).dv}</p>
          <p className="text-sm">{formatDate(p.fecha_inicio)}{p.fecha_fin ? ` - ${formatDate(p.fecha_fin)}` : ''} — <span className="font-semibold">{p._tipo === 'matrimonio' ? '5 días' : `${calcularDias(p.fecha_inicio, (p as any).fecha_fin, (p as any).tipo_jornada || 'completa', feriados)} días`}</span></p>
          <div className="flex items-center gap-2">{estadoBadge(p.estado)}</div>
          <p className="text-sm text-gray-600">{p.motivo}</p>
          {p.estado === 'en_revision' && <div className="flex gap-2 mt-2"><button onClick={() => handleEditOpen(p)} className="inline-flex items-center gap-1 text-sm px-3 py-1 bg-primary-600 text-white rounded-lg"><Pencil className="w-3.5 h-3.5" /> Editar</button>{puedeAprobar && <button onClick={() => handleAprobar(p)} className="inline-flex items-center gap-1 text-sm px-3 py-1 bg-success-600 text-white rounded-lg"><CheckCircle className="w-3.5 h-3.5" /> Aprobar</button>}<button onClick={() => setRechazoModal({ id: p.id, tipo: p._tipo as any, open: true })} className="inline-flex items-center gap-1 text-sm px-3 py-1 bg-danger-600 text-white rounded-lg"><XCircle className="w-3.5 h-3.5" /> Rechazar</button></div>}
          {p.estado === 'aprobado' && <div className="flex flex-wrap gap-2 mt-2">{p._tipo === 'matrimonio' && <button onClick={() => handleGenerarComprobanteMatrimonio(p.id)} className="inline-flex items-center gap-1 text-sm px-3 py-1 bg-pink-600 text-white rounded-lg"><FileText className="w-3.5 h-3.5" /> Comprobante</button>}{renderComprobanteActions(p)}</div>}
        </MobileCard>
      ))}

      <input type="file" ref={fileInputRef} accept=".pdf,.png,.jpg,.jpeg,.gif" onChange={handleFileSelected} className="hidden" />
      <Modal isOpen={rechazoModal.open} onClose={() => setRechazoModal({ id: 0, tipo: 'administrativo', open: false })} title="Rechazar Permiso">
        <div className="space-y-4"><div><label className="block text-sm font-medium mb-1">Motivo de Rechazo</label><textarea value={motivoRechazo} onChange={(e) => setMotivoRechazo(e.target.value)} rows={4} className="w-full px-4 py-2 border rounded-lg outline-none" required /></div><button onClick={handleRechazar} disabled={rejecting} className="flex items-center justify-center gap-2 w-full py-2 bg-danger-600 text-white rounded-lg disabled:opacity-50">{rejecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />} {rejecting ? 'Rechazando...' : 'Rechazar Permiso'}</button></div>
      </Modal>
      <Modal isOpen={editModal.open} onClose={() => setEditModal({ row: null, open: false })} title={`Editar Permiso ${editModal.row?._tipo === 'matrimonio' ? 'por Matrimonio' : 'Administrativo'}`}>
        <div className="space-y-4">
          <div><label className="block text-sm font-medium mb-1">Trabajador</label><div className="px-4 py-2 border rounded-lg bg-gray-50 text-sm">{(editModal.row as any)?.nombres} {(editModal.row as any)?.apellido_paterno}</div></div>
          <div><label className="block text-sm font-medium mb-1">Fecha Inicio</label><input type="date" value={editFechaInicio} onChange={(e) => { setEditFechaInicio(e.target.value); setEditError(''); }} className={`w-full px-4 py-2 border rounded-lg outline-none ${(isWeekend(editFechaInicio) || feriados.includes(editFechaInicio)) ? 'border-red-500' : ''}`} required />{isWeekend(editFechaInicio) && <p className="text-red-500 text-xs mt-1">No puede ser fin de semana</p>}</div>
          {editModal.row?._tipo === 'matrimonio' ? (
            <>
              <div><label className="block text-sm font-medium mb-1">Fecha Fin (5 días hábiles)</label><input type="date" value={editFechaFin} readOnly className="w-full px-4 py-2 border rounded-lg bg-pink-50 text-pink-700 cursor-not-allowed" /></div>
              <div className="bg-pink-50 text-pink-700 px-4 py-2 rounded-lg text-sm">5 días hábiles, cálculo igual que administrativo.</div>
            </>
          ) : (
            <>
              <div><label className="block text-sm font-medium mb-1">Cantidad de Días (permite 0.5 — ej 1.5, 2.5)</label><input type="number" min={0.5} max={6} step={0.5} value={editCantidadDias} onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) setEditCantidadDias(Math.min(6, Math.max(0.5, Math.round(v*2)/2))); }} className="w-full px-4 py-2 border rounded-lg outline-none" required /></div>
              <div><label className="block text-sm font-medium mb-1">Fecha Fin</label><input type="date" value={editFechaFin} readOnly className="w-full px-4 py-2 border rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed" /></div>
              <div className={`px-4 py-2 rounded-lg text-sm ${Number.isInteger(editCantidadDias) ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>{Number.isInteger(editCantidadDias) ? `Jornada completa — ${editCantidadDias} día${editCantidadDias===1?'':'s'} hábiles` : `Media jornada el último día — total ${editCantidadDias} días (${Math.ceil(editCantidadDias)} hábiles, último medio)`}</div>
            </>
          )}
          <div><label className="block text-sm font-medium mb-1">Motivo</label><textarea value={editMotivo} onChange={(e) => setEditMotivo(e.target.value)} rows={4} className="w-full px-4 py-2 border rounded-lg outline-none" required /></div>
          {editError && <div className="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm">{editError}</div>}
          <button onClick={handleEditSave} disabled={savingEdit} className="flex items-center justify-center gap-2 w-full py-2 bg-primary-600 text-white rounded-lg disabled:opacity-50">{savingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pencil className="w-4 h-4" />} {savingEdit ? 'Guardando...' : 'Guardar Cambios'}</button>
        </div>
      </Modal>
    </div>
  );
}
