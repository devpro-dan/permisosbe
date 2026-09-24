import { useState, useEffect, useMemo } from 'react';
import { permisoApi, matrimonioApi } from '../services/api';
import { Permiso, Disponibilidad, PermisoMatrimonio } from '../types';
import { DataTable } from '../components/DataTable';
import { MobileCard } from '../components/MobileCard';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { Modal } from '../components/Modal';
import { FileText, FileSpreadsheet, FileCheck, Heart } from 'lucide-react';
import { formatDate } from '../utils/format';

const calcularDias = (fechaInicio: string, fechaFin: string | null | undefined, tipoJornada: string): number => {
  const d1 = new Date(fechaInicio + "T12:00:00");
  const d2 = new Date((fechaFin || fechaInicio) + "T12:00:00");
  let count = 0; const cur = new Date(d1); while (cur <= d2) { if (cur.getDay()!==0 && cur.getDay()!==6) count++; cur.setDate(cur.getDate()+1); } if(count===0) count=1; return tipoJornada === "media" ? Math.max(0.5, count - 0.5) : count;
};

type TipoFiltro = 'todos' | 'administrativo' | 'matrimonio';

export default function MisPermisos() {
  const [permisos, setPermisos] = useState<Permiso[]>([]);
  const [matrimonios, setMatrimonios] = useState<PermisoMatrimonio[]>([]);
  const [disponibilidad, setDisponibilidad] = useState<Disponibilidad | null>(null);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<TipoFiltro>('todos');
  const [showReporteModal, setShowReporteModal] = useState(false);
  const [anos, setAnos] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [anosLoading, setAnosLoading] = useState(false);
  const [generating, setGenerating] = useState<'pdf' | 'excel' | null>(null);

  useEffect(() => {
    Promise.all([permisoApi.misPermisos(), matrimonioApi.misPermisos().catch(() => ({ data: { permisos: [] } }))])
      .then(([resAdmin, resMat]) => {
        setPermisos(resAdmin.data.permisos);
        setDisponibilidad(resAdmin.data.disponibilidad);
        setMatrimonios(resMat.data.permisos || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const openReporteModal = async () => {
    setShowReporteModal(true);
    setAnosLoading(true);
    try { const res = await permisoApi.reporteAnos(); const lista: number[] = res.data.anos || []; setAnos(lista); if (lista.length > 0) setSelectedYear(lista[0]); }
    catch { const y = new Date().getFullYear(); setAnos([y]); setSelectedYear(y); }
    finally { setAnosLoading(false); }
  };

  const handleDownloadPDF = async (year?: number) => {
    const y = year ?? selectedYear; setGenerating('pdf');
    try { const res = await permisoApi.reportePDF(y); const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' })); const a = document.createElement('a'); a.href = url; a.download = `permisos_${y}.pdf`; a.click(); URL.revokeObjectURL(url); setShowReporteModal(false); } catch (err) { console.error(err); } finally { setGenerating(null); }
  };
  const handleDownloadExcel = async (year?: number) => {
    const y = year ?? selectedYear; setGenerating('excel');
    try { const res = await permisoApi.reporteExcel(y); const url = URL.createObjectURL(new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })); const a = document.createElement('a'); a.href = url; a.download = `permisos_${y}.xlsx`; a.click(); URL.revokeObjectURL(url); setShowReporteModal(false); } catch (err) { console.error(err); } finally { setGenerating(null); }
  };
  const handleDescargarComprobante = async (id: number, tipo: TipoFiltro) => {
    try {
      const res = tipo === 'matrimonio' ? await matrimonioApi.descargarComprobante(id) : await permisoApi.descargarComprobante(id);
      const ct = String(res.headers['content-type'] || ''); const ext = ct.includes('pdf') ? '.pdf' : ct.includes('png') ? '.png' : '.jpg';
      const url = window.URL.createObjectURL(new Blob([res.data])); const a = document.createElement('a'); a.href = url; a.download = `comprobante_${tipo}_${id}${ext}`; a.click(); window.URL.revokeObjectURL(url);
    } catch (err: any) { alert(err.response?.data?.message || 'Error al descargar comprobante'); }
  };
  const handleDescargarCertificado = async (id: number) => {
    try { const res = await permisoApi.certificado(id); const url = window.URL.createObjectURL(new Blob([res.data])); const a = document.createElement('a'); a.href = url; a.download = `certificado_permiso_${id}.pdf`; a.click(); window.URL.revokeObjectURL(url); } catch (err: any) { alert(err.response?.data?.message || 'Error al descargar certificado'); }
  };
  const handleGenerarComprobanteMatrimonio = async (id: number) => {
    try { const res = await matrimonioApi.comprobantePdf(id); const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' })); const a = document.createElement('a'); a.href = url; a.download = `comprobante_matrimonio_${id}.pdf`; a.click(); window.URL.revokeObjectURL(url); } catch (err: any) { alert(err.response?.data?.message || 'Error al generar comprobante'); }
  };

  const estadoBadge = (estado: string) => {
    const colors: Record<string, string> = { en_revision: 'bg-warning-100 text-warning-800', aprobado: 'bg-success-100 text-success-800', rechazado: 'bg-danger-100 text-danger-800' };
    return <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[estado] || 'bg-gray-100'}`}>{estado === 'en_revision' ? 'En Revisión' : estado === 'aprobado' ? 'Aprobado' : 'Rechazado'}</span>;
  };
  const tipoBadge = (t: string) => t === 'matrimonio' ? <span className="px-2 py-1 rounded-full text-xs font-medium bg-pink-100 text-pink-800 inline-flex items-center gap-1"><Heart className="w-3 h-3" /> Matrimonio</span> : <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Administrativo</span>;

  const unificados = useMemo(() => {
    const a = permisos.map((p) => ({ ...p, _tipo: 'administrativo' as const }));
    const m = matrimonios.map((p) => ({ ...p, _tipo: 'matrimonio' as const, tipo_jornada: 'completa' as const }));
    const all = [...a, ...m].sort((x, y) => new Date(y.fecha_solicitud).getTime() - new Date(x.fecha_solicitud).getTime());
    if (filtro === 'todos') return all;
    return all.filter((x) => x._tipo === filtro);
  }, [permisos, matrimonios, filtro]);

  if (loading) return <LoadingSpinner message="Cargando permisos..." />;

  const columns = [
    { key: '_tipo', label: 'Tipo', render: (_: any, row: any) => tipoBadge(row._tipo) },
    { key: 'fecha_solicitud', label: 'Fecha Solicitud', render: (v: string) => formatDate(v) },
    { key: 'fecha_inicio', label: 'Fecha Inicio', render: (v: string) => formatDate(v) },
    { key: 'fecha_fin', label: 'Fecha Fin', render: (v: string) => v ? formatDate(v) : '-' },
    { key: 'dias', label: 'Días', render: (_: any, row: any) => {
      const dias = row._tipo === 'matrimonio' ? 5 : calcularDias(row.fecha_inicio, row.fecha_fin, row.tipo_jornada);
      return <span className={`font-semibold ${row._tipo === 'matrimonio' ? 'text-pink-700' : 'text-primary-700'}`}>{dias} {dias === 1 ? 'día' : 'días'}</span>;
    }},
    { key: 'tipo_jornada', label: 'Jornada', render: (v: string, row: any) => row._tipo === 'matrimonio' ? '-' : v === 'completa' ? 'Completa' : 'Media' },
    { key: 'estado', label: 'Estado', render: (_: any, row: any) => estadoBadge(row.estado) },
    { key: 'motivo', label: 'Motivo' },
    { key: 'motivo_rechazo', label: 'Motivo Rechazo', render: (v: string) => v || '-' },
    { key: 'certificado', label: 'Certificado / Comprobante', render: (_: any, row: any) => {
      if (row.estado !== 'aprobado') return null;
      if (row._tipo === 'administrativo') return <button onClick={() => handleDescargarCertificado(row.id)} className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-800"><FileCheck className="w-3.5 h-3.5" /> Descargar</button>;
      return <button onClick={() => handleGenerarComprobanteMatrimonio(row.id)} className="inline-flex items-center gap-1 text-sm text-pink-600 hover:text-pink-800"><FileCheck className="w-3.5 h-3.5" /> Comprobante</button>;
    } },
    { key: 'comprobante', label: 'Comprobante', render: (_: any, row: any) => row.estado === 'aprobado' && row.comprobante_disponible ? <button onClick={() => handleDescargarComprobante(row.id, row._tipo)} className="inline-flex items-center gap-1 text-sm text-green-600 hover:text-green-800"><FileText className="w-3.5 h-3.5" /> Ver</button> : row.estado === 'aprobado' && !row.comprobante_disponible ? <span className={`text-xs ${row.comprobante_url ? 'text-red-500' : 'text-gray-400'}`}>{row.comprobante_url ? 'No disponible' : 'Sin comprobante'}</span> : null },
  ];

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
        <h1 className="text-2xl font-bold text-gray-800">Mis Permisos</h1>
        <button onClick={openReporteModal} className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700"><FileText className="w-4 h-4" /> Generar informe</button>
      </div>

      <div className="flex bg-gray-100 rounded-lg p-1 mb-4 w-fit">
        {(['todos', 'administrativo', 'matrimonio'] as TipoFiltro[]).map((t) => (
          <button key={t} onClick={() => setFiltro(t)} className={`px-4 py-1.5 text-sm font-medium rounded-md capitalize ${filtro === t ? 'bg-white shadow text-gray-800' : 'text-gray-600'}`}>{t === 'todos' ? 'Todos' : t === 'matrimonio' ? 'Matrimonio' : 'Administrativo'}</button>
        ))}
      </div>

      <Modal isOpen={showReporteModal} onClose={() => setShowReporteModal(false)} title="Generar informe">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Año</label>
            {anosLoading ? <p className="text-sm text-gray-500">Cargando años...</p> : (
              <select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
                {anos.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            )}
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowReporteModal(false)} className="px-4 py-2 text-sm rounded-lg border">Cancelar</button>
            <button onClick={() => handleDownloadExcel()} disabled={generating !== null} className="inline-flex items-center gap-1.5 px-4 py-2 bg-success-600 text-white rounded-lg text-sm disabled:opacity-50"><FileSpreadsheet className="w-4 h-4" /> {generating === 'excel' ? 'Generando...' : 'Excel'}</button>
            <button onClick={() => handleDownloadPDF()} disabled={generating !== null} className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm disabled:opacity-50"><FileText className="w-4 h-4" /> {generating === 'pdf' ? 'Generando...' : 'Generar informe'}</button>
          </div>
        </div>
      </Modal>

      {disponibilidad && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4 text-center"><p className="text-2xl font-bold text-blue-600">{disponibilidad.max}</p><p className="text-sm text-gray-500">Permisos/Año</p></div>
          <div className="bg-white rounded-lg shadow p-4 text-center"><p className="text-2xl font-bold text-orange-600">{disponibilidad.used}</p><p className="text-sm text-gray-500">Usados</p></div>
          <div className="bg-white rounded-lg shadow p-4 text-center"><p className="text-2xl font-bold text-green-600">{disponibilidad.available}</p><p className="text-sm text-gray-500">Disponibles</p></div>
        </div>
      )}

      <DataTable columns={columns} data={unificados as any} />

      {unificados.map((p: any) => (
        <MobileCard key={`${p._tipo}-${p.id}`}>
          <div className="flex justify-between items-start">
            <div><p className="font-medium">{formatDate(p.fecha_solicitud)}</p><p className="text-sm text-gray-500">{formatDate(p.fecha_inicio)}{p.fecha_fin ? ` - ${formatDate(p.fecha_fin)}` : ''}</p></div>
            <div className="flex flex-col gap-1 items-end">{tipoBadge(p._tipo)}{estadoBadge(p.estado)}</div>
          </div>
          <p className="text-sm font-semibold text-primary-700">{p._tipo === 'matrimonio' ? '5 días' : `${calcularDias(p.fecha_inicio, p.fecha_fin, p.tipo_jornada)} días`}</p>
          <p className="text-sm text-gray-600"><strong>Motivo:</strong> {p.motivo}</p>
          {p.motivo_rechazo && <p className="text-sm text-red-600"><strong>Rechazo:</strong> {p.motivo_rechazo}</p>}
          {p.estado === 'aprobado' && p._tipo === 'administrativo' && <button onClick={() => handleDescargarCertificado(p.id)} className="inline-flex items-center gap-1 text-sm text-primary-600 mt-2"><FileCheck className="w-3.5 h-3.5" /> Descargar certificado</button>}
          {p.estado === 'aprobado' && p._tipo === 'matrimonio' && <button onClick={() => handleGenerarComprobanteMatrimonio(p.id)} className="inline-flex items-center gap-1 text-sm text-pink-600 mt-2"><FileCheck className="w-3.5 h-3.5" /> Descargar comprobante</button>}
        </MobileCard>
      ))}
    </div>
  );
}
