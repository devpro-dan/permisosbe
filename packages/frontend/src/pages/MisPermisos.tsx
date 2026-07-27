import { useState, useEffect } from 'react';
import { permisoApi } from '../services/api';
import { Permiso, Disponibilidad } from '../types';
import { DataTable } from '../components/DataTable';
import { MobileCard } from '../components/MobileCard';
import { LoadingSpinner } from '../components/LoadingSpinner';

export default function MisPermisos() {
  const [permisos, setPermisos] = useState<Permiso[]>([]);
  const [disponibilidad, setDisponibilidad] = useState<Disponibilidad | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    permisoApi.misPermisos()
      .then((res) => {
        setPermisos(res.data.permisos);
        setDisponibilidad(res.data.disponibilidad);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleDownloadPDF = async () => {
    try {
      const res = await permisoApi.reportePDF();
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      window.open(url, '_blank');
    } catch (err) {
      console.error(err);
    }
  };

  const handleDownloadExcel = async () => {
    try {
      const res = await permisoApi.reporteExcel();
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'permisos.xlsx';
      a.click();
    } catch (err) {
      console.error(err);
    }
  };

  const estadoBadge = (estado: string) => {
    const colors: Record<string, string> = {
      en_revision: 'bg-yellow-100 text-yellow-800',
      aprobado: 'bg-green-100 text-green-800',
      rechazado: 'bg-red-100 text-red-800',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[estado] || 'bg-gray-100'}`}>
        {estado === 'en_revision' ? 'En Revisión' : estado === 'aprobado' ? 'Aprobado' : 'Rechazado'}
      </span>
    );
  };

  if (loading) return <LoadingSpinner message="Cargando permisos..." />;

  const columns = [
    { key: 'fecha_solicitud', label: 'Fecha Solicitud', render: (v: string) => new Date(v).toLocaleDateString() },
    { key: 'fecha_inicio', label: 'Fecha Inicio' },
    { key: 'fecha_fin', label: 'Fecha Fin', render: (v: string) => v || '-' },
    { key: 'tipo_jornada', label: 'Jornada', render: (v: string) => v === 'completa' ? 'Completa' : 'Media' },
    { key: 'estado', label: 'Estado', render: (_: any, row: Permiso) => estadoBadge(row.estado) },
    { key: 'motivo', label: 'Motivo' },
    { key: 'motivo_rechazo', label: 'Motivo Rechazo', render: (v: string) => v || '-' },
  ];

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Mis Permisos</h1>
        <div className="flex gap-2">
          <button onClick={handleDownloadPDF} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
            PDF
          </button>
          <button onClick={handleDownloadExcel} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">
            Excel
          </button>
        </div>
      </div>

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
              <p className="font-medium">{new Date(p.fecha_solicitud).toLocaleDateString()}</p>
              <p className="text-sm text-gray-500">{p.fecha_inicio}{p.fecha_fin ? ` - ${p.fecha_fin}` : ''}</p>
            </div>
            {estadoBadge(p.estado)}
          </div>
          <p className="text-sm text-gray-600"><strong>Jornada:</strong> {p.tipo_jornada === 'completa' ? 'Completa' : 'Media'}</p>
          <p className="text-sm text-gray-600"><strong>Motivo:</strong> {p.motivo}</p>
          {p.motivo_rechazo && <p className="text-sm text-red-600"><strong>Rechazo:</strong> {p.motivo_rechazo}</p>}
        </MobileCard>
      ))}
    </div>
  );
}
