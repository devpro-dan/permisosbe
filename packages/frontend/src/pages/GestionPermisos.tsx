import { useState, useEffect, useMemo } from 'react';
import { permisoApi } from '../services/api';
import { Permiso } from '../types';
import { DataTable } from '../components/DataTable';
import { MobileCard } from '../components/MobileCard';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { Modal } from '../components/Modal';
import { CheckCircle, XCircle, Trash2, FileText, Search, Calendar, X } from 'lucide-react';
import { formatDate } from '../utils/format';

const calcularDias = (fechaInicio: string, fechaFin: string | null | undefined, tipoJornada: string): number => {
  const inicio = new Date(fechaInicio);
  const fin = fechaFin ? new Date(fechaFin) : new Date(fechaInicio);
  
  const diffTime = Math.abs(fin.getTime() - inicio.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  
  return tipoJornada === 'media' ? diffDays * 0.5 : diffDays;
};

export default function GestionPermisos() {
  const [permisos, setPermisos] = useState<Permiso[]>([]);
  const [loading, setLoading] = useState(true);
  const [rechazoModal, setRechazoModal] = useState<{ id: number; open: boolean }>({ id: 0, open: false });
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const [aprobarModal, setAprobarModal] = useState<{ id: number; open: boolean }>({ id: 0, open: false });
  const [comprobanteFile, setComprobanteFile] = useState<File | null>(null);
  const [subiendoComprobante, setSubiendoComprobante] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');

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
      setAprobarModal({ id: 0, open: false });
      setComprobanteFile(null);
      load();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al aprobar');
    } finally {
      setSubiendoComprobante(false);
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

  const limpiarFiltros = () => {
    setSearchTerm('');
    setFechaInicio('');
    setFechaFin('');
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
      key: 'comprobante', label: 'Comprobante', render: (_: any, row: Permiso) =>
        row.estado === 'aprobado' && row.comprobante_url ? (
          <button onClick={() => handleDescargarComprobante(row.id)} className="inline-flex items-center gap-1 text-sm text-green-600 hover:text-green-800">
            <FileText className="w-3.5 h-3.5" /> Ver
          </button>
        ) : row.estado === 'aprobado' && !row.comprobante_url ? (
          <span className="text-xs text-gray-400">Sin comprobante</span>
        ) : null,
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
              {p.comprobante_url && (
                <button onClick={() => handleDescargarComprobante(p.id)} className="inline-flex items-center gap-1 text-sm text-green-600 hover:text-green-800">
                  <FileText className="w-3.5 h-3.5" /> Comprobante
                </button>
              )}
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
          <button onClick={handleRechazar} className="flex items-center justify-center gap-2 w-full py-2 bg-danger-600 hover:bg-danger-700 text-white rounded-lg">
            <XCircle className="w-4 h-4" /> Rechazar Permiso
          </button>
        </div>
      </Modal>
    </div>
  );
}
