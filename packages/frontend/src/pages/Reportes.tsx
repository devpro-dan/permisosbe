import { useState } from 'react';
import { FileSpreadsheet, FileText, Search, X } from 'lucide-react';
import { permisoApi } from '../services/api';
import { toast } from '../components/Toast';

function downloadBlob(data: BlobPart, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function Reportes() {
  const [employee, setEmployee] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [year, setYear] = useState('');
  const [loading, setLoading] = useState<'pdf' | 'excel' | null>(null);

  const params = () => Object.fromEntries(
    Object.entries({ employee, startDate, endDate, year }).filter(([, value]) => value !== '')
  ) as Record<string, string>;

  const generate = async (format: 'pdf' | 'excel') => {
    setLoading(format);
    try {
      const response = format === 'pdf'
        ? await permisoApi.reporteGeneralPDF(params())
        : await permisoApi.reporteGeneralExcel(params());
      downloadBlob(
        response.data,
        `reporte_general_permisos.${format === 'pdf' ? 'pdf' : 'xlsx'}`,
        format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      toast({ message: 'Reporte generado correctamente', type: 'success' });
    } catch (error: any) {
      toast({ message: error.response?.data?.message || 'Error al generar reporte', type: 'error' });
    } finally {
      setLoading(null);
    }
  };

  const clear = () => {
    setEmployee('');
    setStartDate('');
    setEndDate('');
    setYear('');
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-2">Reportes</h1>
      <p className="text-gray-500 mb-6">Genera reportes de permisos de todos los funcionarios usando filtros opcionales.</p>

      <div className="bg-white rounded-lg shadow p-5 max-w-4xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1"><Search className="inline w-4 h-4 mr-1" />Funcionario</label>
            <input value={employee} onChange={(e) => setEmployee(e.target.value)} placeholder="Nombre o RUT" className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Año</label>
            <input type="number" min="2000" max="2100" value={year} onChange={(e) => setYear(e.target.value)} placeholder="Todos los años" className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Desde</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Hasta</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full px-4 py-2 border rounded-lg outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
        </div>

        <div className="flex flex-wrap gap-3 mt-6">
          <button onClick={() => generate('pdf')} disabled={loading !== null} className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg disabled:opacity-50">
            <FileText className="w-4 h-4" /> {loading === 'pdf' ? 'Generando...' : 'Generar PDF'}
          </button>
          <button onClick={() => generate('excel')} disabled={loading !== null} className="inline-flex items-center gap-2 px-4 py-2 bg-success-600 hover:bg-success-700 text-white rounded-lg disabled:opacity-50">
            <FileSpreadsheet className="w-4 h-4" /> {loading === 'excel' ? 'Generando...' : 'Generar Excel'}
          </button>
          <button onClick={clear} disabled={loading !== null} className="inline-flex items-center gap-2 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg disabled:opacity-50">
            <X className="w-4 h-4" /> Limpiar filtros
          </button>
        </div>
      </div>
    </div>
  );
}
