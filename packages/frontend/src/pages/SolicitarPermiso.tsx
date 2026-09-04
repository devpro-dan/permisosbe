import { useState, useMemo, useEffect } from 'react';
import { permisoApi, matrimonioApi, feriadoApi } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { toast } from '../components/Toast';
import { Send, Heart } from 'lucide-react';
import { isWeekend, addBusinessDays } from '../utils/dates';

type TipoPermiso = 'administrativo' | 'matrimonio';
const DIAS_MATRIMONIO = 5;

export default function SolicitarPermiso() {
  const navigate = useNavigate();
  const today = new Date().toISOString().split('T')[0];
  const [tipoPermiso, setTipoPermiso] = useState<TipoPermiso>('administrativo');
  const [fechaInicio, setFechaInicio] = useState(today);
  const [cantidadDias, setCantidadDias] = useState(1);
  const MAX_PERMISOS = 6;
  const [tipoJornada, setTipoJornada] = useState<'completa' | 'media'>('completa');
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [feriados, setFeriados] = useState<string[]>([]);

  const fechaFin = useMemo(() => {
    const dias = tipoPermiso === 'matrimonio' ? DIAS_MATRIMONIO - 1 : cantidadDias - 1;
    return addBusinessDays(fechaInicio, dias, feriados);
  }, [fechaInicio, cantidadDias, feriados, tipoPermiso]);

  useEffect(() => {
    feriadoApi.list(new Date().getFullYear()).then((res) => setFeriados(res.data.map((f: any) => f.fecha))).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (isWeekend(fechaInicio)) { setError('La fecha de inicio no puede ser fin de semana'); return; }
    if (feriados.includes(fechaInicio)) { setError('La fecha de inicio corresponde a un feriado'); return; }
    if (tipoPermiso === 'administrativo' && (cantidadDias < 1 || cantidadDias > MAX_PERMISOS)) { setError(`La cantidad de días debe estar entre 1 y ${MAX_PERMISOS}`); return; }
    if (isWeekend(fechaFin) || feriados.includes(fechaFin)) { setError('La fecha de término cae en finde/feriado, elige otra fecha de inicio'); return; }
    setLoading(true);
    try {
      if (tipoPermiso === 'matrimonio') {
        await matrimonioApi.solicitar({ fecha_inicio: fechaInicio, motivo });
        toast({ message: 'Permiso por matrimonio solicitado correctamente', type: 'success' });
      } else {
        await permisoApi.solicitar({ fecha_inicio: fechaInicio, fecha_fin: fechaFin, tipo_jornada: cantidadDias > 1 ? 'completa' : tipoJornada, motivo });
        toast({ message: 'Permiso solicitado correctamente', type: 'success' });
      }
      navigate('/mis-permisos');
    } catch (err: any) { setError(err.response?.data?.message || 'Error al solicitar permiso'); }
    finally { setLoading(false); }
  };

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-4">Solicitar Permiso</h1>
      <div className="flex bg-gray-100 rounded-lg p-1 mb-6">
        <button type="button" onClick={() => setTipoPermiso('administrativo')} className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${tipoPermiso === 'administrativo' ? 'bg-white shadow text-primary-700' : 'text-gray-600 hover:text-gray-800'}`}>Administrativo</button>
        <button type="button" onClick={() => setTipoPermiso('matrimonio')} className={`flex-1 py-2 text-sm font-medium rounded-md flex items-center justify-center gap-1.5 transition-colors ${tipoPermiso === 'matrimonio' ? 'bg-white shadow text-pink-700' : 'text-gray-600 hover:text-gray-800'}`}><Heart className="w-4 h-4" /> Matrimonio (5 días)</button>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Inicio</label>
          <input type="date" value={fechaInicio} onChange={(e) => { setFechaInicio(e.target.value); setError(''); }} className={`w-full px-4 py-2 border rounded-lg focus:ring-2 outline-none ${tipoPermiso === 'matrimonio' ? 'focus:ring-pink-500' : 'focus:ring-blue-500'} ${(isWeekend(fechaInicio) || feriados.includes(fechaInicio)) ? 'border-red-500' : ''}`} required />
          {isWeekend(fechaInicio) && <p className="text-red-500 text-xs mt-1">No puede ser fin de semana</p>}
          {!isWeekend(fechaInicio) && feriados.includes(fechaInicio) && <p className="text-red-500 text-xs mt-1">Corresponde a un feriado</p>}
        </div>

        {tipoPermiso === 'administrativo' ? (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad de Días (máx. {MAX_PERMISOS})</label>
              <input type="number" min={1} max={MAX_PERMISOS} value={cantidadDias} onChange={(e) => setCantidadDias(Math.min(MAX_PERMISOS, Math.max(1, parseInt(e.target.value) || 1)))} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Fin</label>
              <input type="date" value={fechaFin} readOnly className="w-full px-4 py-2 border rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed" />
            </div>
            {cantidadDias === 1 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Jornada</label>
                <select value={tipoJornada} onChange={(e) => setTipoJornada(e.target.value as 'completa' | 'media')} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none">
                  <option value="completa">Jornada Completa</option>
                  <option value="media">Media Jornada</option>
                </select>
              </div>
            )}
            {cantidadDias > 1 && <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-lg text-sm">Para múltiples días, la jornada será completa.</div>}
          </>
        ) : (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Fin (5 días hábiles)</label>
              <input type="date" value={fechaFin} readOnly className="w-full px-4 py-2 border rounded-lg bg-pink-50 text-pink-800 font-medium cursor-not-allowed" />
              <p className="text-xs text-gray-500 mt-1">Cálculo igual que permiso administrativo: {fechaInicio} → {fechaFin} (salta finde/feriado).</p>
            </div>
            <div className="bg-pink-50 text-pink-700 px-4 py-2 rounded-lg text-sm">Otorga exactamente 5 días hábiles en jornada completa.</div>
          </>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Motivo</label>
          <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={4} className={`w-full px-4 py-2 border rounded-lg outline-none ${tipoPermiso === 'matrimonio' ? 'focus:ring-pink-500' : 'focus:ring-blue-500'} focus:ring-2`} placeholder={tipoPermiso === 'matrimonio' ? 'Matrimonio' : 'Motivo del permiso'} required />
        </div>
        {error && <div className="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm">{error}</div>}
        <button type="submit" disabled={loading} className={`flex items-center justify-center gap-2 w-full py-2 font-medium rounded-lg transition-colors disabled:opacity-50 ${tipoPermiso === 'matrimonio' ? 'bg-pink-600 hover:bg-pink-700' : 'bg-primary-600 hover:bg-primary-700'} text-white`}>
          {loading ? 'Solicitando...' : <><Send className="w-4 h-4" /> {tipoPermiso === 'matrimonio' ? 'Solicitar Matrimonio' : 'Solicitar Permiso'}</>}
        </button>
      </form>
    </div>
  );
}
