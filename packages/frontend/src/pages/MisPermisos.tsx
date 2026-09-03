import { useState, useEffect } from 'react';
import { permisoApi } from '../services/api';
import { Permiso, Disponibilidad } from '../types';
import { DataTable } from '../components/DataTable';
import { MobileCard } from '../components/MobileCard';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { Modal } from '../components/Modal';
import { FileText, FileSpreadsheet, FileCheck } from 'lucide-react';
import { formatDate } from '../utils/format';

const calcularDias = (fechaInicio: string, fechaFin: string | null | undefined, tipoJornada: string): number => {
  const d1 = new Date(fechaInicio + "T12:00:00");
  const d2 = new Date((fechaFin || fechaInicio) + "T12:00:00");
  let count = 0; const cur = new Date(d1); while (cur <= d2) { if (cur.getDay()!==0 && cur.getDay()!==6) count++; cur.setDate(cur.getDate()+1); } if(count===0) count=1; return tipoJornada === "media" ? count*0.5 : count;
};

export default function MisPermisos() {
  const [permisos, setPermisos] = useState<Permiso[]>([]);
  const [disponibilidad, setDisponibilidad] = useState<Disponibilidad | null>(null);
  const [loading, setLoading] = useState(true);
  const [showReporteModal, setShowReporteModal] = useState(false);
  const [anos, setAnos] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [anosLoading, setAnosLoading] = useState(false);
  const [generating, setGenerating] = useState<'pdf' | 'excel' | null>(null);

  useEffect(() => {
    permisoApi.misPermisos()
      .then((res) => {
        setPermisos(res.data.permisos);
        setDisponibilidad(res.data.disponibilidad);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const openReporteModal = async () => {
    setShowReporteModal(true);
    setAnosLoading(true);
    try {
      const res = await permisoApi.reporteAnos();
      const lista: number[] = res.data.anos || [];
      setAnos(lista);
      if (lista.length > 0) setSelectedYear(lista[0]);
    } catch {
      const y = new Date().getFullYear();
      setAnos([y]);
      setSelectedYear(y);
    } finally {
      setAnosLoading(false);
    }
  };

  const handleDownloadPDF = async (year?: number) => {
    const y = year ?? selectedYear;
    setGenerating('pdf');
    try {
      const res = await permisoApi.reportePDF(y);
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `permisos_${y}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setShowReporteModal(false);
    } catch (err) {
      console.error(err);
    } finally {
      setGenerating(null);
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

  const handleDownloadExcel = async (year?: number) => {
    const y = year ?? selectedYear;
    setGenerating('excel');
    try {
      const res = await permisoApi.reporteExcel(y);
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `permisos_${y}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      setShowReporteModal(false);
    } catch (err) {
      console.error(err);
    } finally {
      setGenerating(null);
    }
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
    { key: 'fecha_solicitud', label: 'Fecha Solicitud', render: (v: string) => formatDate(v) },
    { key: 'fecha_inicio', label: 'Fecha Inicio', render: (v: string) => formatDate(v) },
    { key: 'fecha_fin', label: 'Fecha Fin', render: (v: string) => v ? formatDate(v) : '-' },
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
    { key: 'motivo_rechazo', label: 'Motivo Rechazo', render: (v: string) => v || '-' },
    {
      key: 'certificado', label: 'Certificado', render: (_: any, row: Permiso) =>
        row.estado === 'aprobado' ? (
          <button onClick={() => handleDescargarCertificado(row.id)} className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-800">
            <FileCheck className="w-3.5 h-3.5" /> Descargar
          </button>
        ) : null,
    },
    {
      key: 'comprobante', label: 'Comprobante', render: (_: any, row: Permiso) =>
        row.estado === 'aprobado' && row.comprobante_disponible ? (
          <button onClick={() => handleDescargarComprobante(row.id)} className="inline-flex items-center gap-1 text-sm text-green-600 hover:text-green-800">
            <FileText className="w-3.5 h-3.5" /> Ver
          </button>
          ) : row.estado === 'aprobado' && !row.comprobante_disponible ? (
          <span className={`text-xs ${row.comprobante_url ? 'text-red-500' : 'text-gray-400'}`}>
            {row.comprobante_url ? 'No disponible' : 'Sin comprobante'}
          </span>
        ) : null,
    },
  ];

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Mis Permisos</h1>
        <div className="flex gap-2">
          <button onClick={openReporteModal} className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 transition-colors">
            <FileText className="w-4 h-4" /> Generar informe
          </button>
        </div>
      </div>
      <Modal isOpen={showReporteModal} onClose={() => setShowReporteModal(false)} title="Generar informe">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Año</label>
            {anosLoading ? (
              <p className="text-sm text-gray-500">Cargando años...</p>
            ) : (
              <select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
                {anos.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            )}
            <p className="text-xs text-gray-400 mt-1">Años con permisos registrados (precargado desde BD)</p>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowReporteModal(false)} className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50">Cancelar</button>
            <button onClick={() => handleDownloadExcel()} disabled={generating !== null} className="inline-flex items-center gap-1.5 px-4 py-2 bg-success-600 text-white rounded-lg text-sm hover:bg-success-700 disabled:opacity-50">
              <FileSpreadsheet className="w-4 h-4" /> {generating === 'excel' ? 'Generando...' : 'Excel'}
            </button>
            <button onClick={() => handleDownloadPDF()} disabled={generating !== null} className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">
              <FileText className="w-4 h-4" /> {generating === 'pdf' ? 'Generando...' : 'Generar informe'}
            </button>
          </div>
        </div>
      </Modal>

      {disponibilidad && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{disponibilidad.max}</p>
            <p className="text-sm text-gray-500">Permisos/Año</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <p className="text-2xl font-bold text-orange-600">{disponibilidad.used}</p>
            <p className="text-sm text-gray-500">Usados</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{disponibilidad.available}</p>
            <p className="text-sm text-gray-500">Disponibles</p>
          </div>
        </div>
      )}

      <DataTable columns={columns} data={permisos} />

      {permisos.map((p) => (
        <MobileCard key={p.id}>
          <div className="flex justify-between items-start">
            <div>
              <p className="font-medium">{formatDate(p.fecha_solicitud)}</p>
              <p className="text-sm text-gray-500">{formatDate(p.fecha_inicio)}{p.fecha_fin ? ` - ${formatDate(p.fecha_fin)}` : ''}</p>
            </div>
            {estadoBadge(p.estado)}
          </div>
          <p className="text-sm font-semibold text-primary-700">
            {calcularDias(p.fecha_inicio, p.fecha_fin, p.tipo_jornada)} días
          </p>
          <p className="text-sm text-gray-600"><strong>Jornada:</strong> {p.tipo_jornada === 'completa' ? 'Completa' : 'Media'}</p>
          <p className="text-sm text-gray-600"><strong>Motivo:</strong> {p.motivo}</p>
          {p.motivo_rechazo && <p className="text-sm text-red-600"><strong>Rechazo:</strong> {p.motivo_rechazo}</p>}
          {p.estado === 'aprobado' && (
            <div className="flex gap-2 mt-2">
              <button onClick={() => handleDescargarCertificado(p.id)} className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800">
                <FileCheck className="w-3.5 h-3.5" /> Certificado
              </button>
              {p.comprobante_disponible && (
                <button onClick={() => handleDescargarComprobante(p.id)} className="inline-flex items-center gap-1 text-sm text-green-600 hover:text-green-800">
                  <FileText className="w-3.5 h-3.5" /> Comprobante
                </button>
              )}
            </div>
          )}
        </MobileCard>
      ))}
    </div>
  );
}
