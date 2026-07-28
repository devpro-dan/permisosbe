import { useState, useMemo } from 'react';
import { permisoApi } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { Send } from 'lucide-react';

function addDays(date: string, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export default function SolicitarPermiso() {
  const navigate = useNavigate();
  const today = new Date().toISOString().split('T')[0];

  const [fechaInicio, setFechaInicio] = useState(today);
  const [cantidadDias, setCantidadDias] = useState(1);
  const [tipoJornada, setTipoJornada] = useState<'completa' | 'media'>('completa');
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const fechaFin = useMemo(() => addDays(fechaInicio, cantidadDias - 1), [fechaInicio, cantidadDias]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await permisoApi.solicitar({
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        tipo_jornada: cantidadDias > 1 ? 'completa' : tipoJornada,
        motivo,
      });
      navigate('/mis-permisos');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al solicitar permiso');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Solicitar Permiso Administrativo</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Inicio</label>
          <input
            type="date"
            value={fechaInicio}
            onChange={(e) => setFechaInicio(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad de Días</label>
          <input
            type="number"
            min={1}
            value={cantidadDias}
            onChange={(e) => setCantidadDias(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Fin</label>
          <input
            type="date"
            value={fechaFin}
            readOnly
            className="w-full px-4 py-2 border rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
          />
        </div>

        {cantidadDias === 1 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Jornada</label>
            <select
              value={tipoJornada}
              onChange={(e) => setTipoJornada(e.target.value as 'completa' | 'media')}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="completa">Jornada Completa</option>
              <option value="media">Media Jornada</option>
            </select>
          </div>
        )}

        {cantidadDias > 1 && (
          <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-lg text-sm">
            Para permisos de múltiples días, la jornada será completa.
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Motivo</label>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={4}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            required
          />
        </div>

        {error && <div className="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm">{error}</div>}

        <button
          type="submit"
          disabled={loading}
          className="flex items-center justify-center gap-2 w-full py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? 'Solicitando...' : <><Send className="w-4 h-4" /> Solicitar Permiso</>}
        </button>
      </form>
    </div>
  );
}
