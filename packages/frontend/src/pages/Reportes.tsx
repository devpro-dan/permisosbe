import { useState, useEffect, useMemo } from 'react';
import { Search, Calendar, FileSpreadsheet, FileText, X, Filter } from 'lucide-react';
import { permisoApi, userApi } from '../services/api';
import { Permiso, User } from '../types';
import { DataTable } from '../components/DataTable';
import { MobileCard } from '../components/MobileCard';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { formatDate } from '../utils/format';
import { toast } from '../components/Toast';

function downloadBlob(data: BlobPart, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - i);

const calcularDias = (fechaInicio: string, fechaFin: string | null | undefined, tipoJornada: string): number => {
  const inicio = new Date(fechaInicio);
  const fin = fechaFin ? new Date(fechaFin) : new Date(fechaInicio);
  const diffTime = Math.abs(fin.getTime() - inicio.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return tipoJornada === 'media' ? diffDays * 0.5 : diffDays;
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

export default function Reportes() {
  const [employee, setEmployee] = useState('');
  const [year, setYear] = useState(String(currentYear));
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [data, setData] = useState<Permiso[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [exporting, setExporting] = useState<'pdf' | 'excel' | null>(null);
  const [usuarios, setUsuarios] = useState<User[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    userApi.list().then((res) => setUsuarios(res.data)).catch(() => {});
  }, []);

  const filteredUsuarios = employee
    ? usuarios.filter((u) => {
        const fullName = `${u.nombres} ${u.apellido_paterno} ${u.apellido_materno || ''}`.toLowerCase();
        const rutFull = `${u.rut}-${u.dv}`;
        const term = employee.toLowerCase();
        return fullName.includes(term) || rutFull.includes(term);
      })
    : [];

  const params = () => Object.fromEntries(
    Object.entries({ employee, startDate, endDate, year }).filter(([, v]) => v !== '')
  ) as Record<string, string>;

  const handleBuscar = async () => {
    setLoading(true);
    setSearched(true);
    try {
      const res = await permisoApi.reporteConsulta(params());
      setData(res.data);
    } catch (err: any) {
      toast({ message: err.response?.data?.message || 'Error al consultar reportes', type: 'error' });
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format: 'pdf' | 'excel') => {
    setExporting(format);
    try {
      const response = format === 'pdf'
        ? await permisoApi.reporteGeneralPDF(params())
        : await permisoApi.reporteGeneralExcel(params());
      downloadBlob(
        response.data,
        `reporte_general_permisos.${format === 'pdf' ? 'pdf' : 'xlsx'}`,
        format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      toast({ message: 'Reporte exportado correctamente', type: 'success' });
    } catch (err: any) {
      toast({ message: err.response?.data?.message || 'Error al exportar reporte', type: 'error' });
    } finally {
      setExporting(null);
    }
  };

  const clear = () => {
    setEmployee('');
    setYear(String(currentYear));
    setStartDate('');
    setEndDate('');
    setData([]);
    setSearched(false);
  };

  const columns = [
    { key: 'nombres', label: 'Funcionario', render: (_: any, row: Permiso) => `${row.nombres} ${row.apellido_paterno}` },
    { key: 'rut', label: 'RUT', render: (_: any, row: Permiso) => `${row.rut}-${row.dv}` },
    { key: 'fecha_inicio', label: 'Fecha Inicio', render: (v: string) => formatDate(v) },
    { key: 'fecha_fin', label: 'Fecha Fin', render: (v: string | null) => v ? formatDate(v) : '-' },
    {
      key: 'dias',
      label: 'Días',
      render: (_: any, row: Permiso) => {
        const dias = calcularDias(row.fecha_inicio, row.fecha_fin, row.tipo_jornada);
        return <span className="font-semibold text-primary-700">{dias} {dias === 1 ? 'día' : 'días'}</span>;
      }
    },
    { key: 'tipo_jornada', label: 'Jornada', render: (v: string) => v === 'completa' ? 'Completa' : 'Media' },
    { key: 'estado', label: 'Estado', render: (_: any, row: Permiso) => estadoBadge(row.estado) },
    { key: 'motivo', label: 'Motivo' },
  ];

  const hasFilters = employee || startDate || endDate || year;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-2">Reportes</h1>
      <p className="text-gray-500 mb-6">Consulta y exporta permisos de todos los funcionarios aplicando filtros.</p>

      <div className="bg-white rounded-lg shadow p-5 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Search className="inline w-4 h-4 mr-1" />Funcionario
            </label>
            <input
              value={employee}
              onChange={(e) => { setEmployee(e.target.value); setShowDropdown(true); }}
              onFocus={() => setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
              onKeyDown={(e) => e.key === 'Enter' && handleBuscar()}
              placeholder="Nombre o RUT"
              className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-primary-500"
            />
            {employee && showDropdown && filteredUsuarios.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {filteredUsuarios.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => { setEmployee(`${u.nombres} ${u.apellido_paterno}`); setShowDropdown(false); }}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-blue-50 transition-colors"
                  >
                    <span className="font-medium">{u.nombres} {u.apellido_paterno}</span>
                    <span className="text-gray-500 ml-2">{u.rut}-{u.dv}</span>
                    <span className="text-gray-400 ml-2 text-xs">{u.cargo}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Calendar className="inline w-4 h-4 mr-1" />Año
            </label>
            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-primary-500 bg-white"
            >
              <option value="">Todos</option>
              {yearOptions.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Calendar className="inline w-4 h-4 mr-1" />Desde
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Calendar className="inline w-4 h-4 mr-1" />Hasta
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-3 mt-5">
          <button
            onClick={handleBuscar}
            disabled={loading}
            className="inline-flex items-center gap-2 px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            <Filter className="w-4 h-4" /> {loading ? 'Buscando...' : 'Buscar'}
          </button>
          <button
            onClick={() => handleExport('pdf')}
            disabled={exporting !== null || data.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 bg-danger-600 hover:bg-danger-700 text-white rounded-lg disabled:opacity-50 transition-colors"
          >
            <FileText className="w-4 h-4" /> {exporting === 'pdf' ? 'Exportando...' : 'Exportar PDF'}
          </button>
          <button
            onClick={() => handleExport('excel')}
            disabled={exporting !== null || data.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 bg-success-600 hover:bg-success-700 text-white rounded-lg disabled:opacity-50 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" /> {exporting === 'excel' ? 'Exportando...' : 'Exportar Excel'}
          </button>
          <button
            onClick={clear}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4" /> Limpiar
          </button>
        </div>
      </div>

      {searched && (
        <div className="flex items-center justify-between bg-primary-50 border border-primary-200 rounded-lg p-3 mb-4">
          <p className="text-sm text-primary-800">
            {loading ? 'Buscando...' : (
              <>Se encontraron <span className="font-semibold">{data.length}</span> registro{data.length !== 1 ? 's' : ''}</>
            )}
          </p>
        </div>
      )}

      {loading ? (
        <LoadingSpinner message="Cargando datos..." />
      ) : searched ? (
        <>
          <DataTable columns={columns} data={data} />
          {data.map((p) => (
            <MobileCard key={p.id}>
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
              <p className="text-sm text-gray-600 mt-1">{p.motivo}</p>
            </MobileCard>
          ))}
        </>
      ) : (
        <div className="text-center py-16 text-gray-400 bg-white rounded-lg shadow">
          <Filter className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-lg font-medium">Aplica filtros y presiona Buscar</p>
          <p className="text-sm mt-1">Puedes filtrar por funcionario, año o rango de fechas.</p>
        </div>
      )}
    </div>
  );
}
