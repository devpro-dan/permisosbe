import { useState, useMemo, useEffect } from 'react';
import { permisoApi, matrimonioApi, userApi, feriadoApi } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { toast } from '../components/Toast';
import { Send, Search, Heart } from 'lucide-react';
import { User } from '../types';
import { isWeekend, addBusinessDays } from '../utils/dates';

type TipoPermiso = 'administrativo' | 'matrimonio';
const DIAS_MATRIMONIO = 5;

export default function RegistrarPermiso() {
  const navigate = useNavigate();
  const today = new Date().toISOString().split('T')[0];
  const [tipoPermiso, setTipoPermiso] = useState<TipoPermiso>('administrativo');
  const [usuarios, setUsuarios] = useState<User[]>([]);
  const [feriados, setFeriados] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<number | ''>('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [fechaInicio, setFechaInicio] = useState(today);
  const [cantidadDias, setCantidadDias] = useState(1);
  const MAX_PERMISOS = 6;
  const [tipoJornada, setTipoJornada] = useState<'completa' | 'media'>('completa');
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const fechaFin = useMemo(() => addBusinessDays(fechaInicio, (tipoPermiso === 'matrimonio' ? DIAS_MATRIMONIO : cantidadDias) - 1, feriados), [fechaInicio, cantidadDias, feriados, tipoPermiso]);

  useEffect(() => {
    userApi.list().then((res) => setUsuarios(res.data)).catch(() => {});
    feriadoApi.list(new Date().getFullYear()).then((res) => setFeriados(res.data.map((f: any) => f.fecha))).catch(() => {});
  }, []);

  const filteredUsuarios = usuarios.filter((u) => {
    const fullName = `${u.nombres} ${u.apellido_paterno} ${u.apellido_materno || ''}`.toLowerCase();
    return fullName.includes(searchTerm.toLowerCase()) || `${u.rut}-${u.dv}`.includes(searchTerm.toLowerCase());
  });
  const selectedUser = usuarios.find((u) => u.id === selectedUserId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) { setError('Debes seleccionar un trabajador'); return; }
    setError('');
    if (isWeekend(fechaInicio)) { setError('La fecha de inicio no puede ser fin de semana'); return; }
    if (feriados.includes(fechaInicio)) { setError('Corresponde a un feriado'); return; }
    if (tipoPermiso === 'administrativo' && (cantidadDias < 1 || cantidadDias > MAX_PERMISOS)) { setError(`Debe estar entre 1 y ${MAX_PERMISOS}`); return; }
    if (isWeekend(fechaFin) || feriados.includes(fechaFin)) { setError('Fecha de término cae en finde/feriado'); return; }
    setLoading(true);
    try {
      if (tipoPermiso === 'matrimonio') {
        await matrimonioApi.registrarParaUsuario({ user_id: selectedUserId, fecha_inicio: fechaInicio, motivo });
        toast({ message: 'Permiso por matrimonio registrado', type: 'success' });
      } else {
        await permisoApi.registrarParaUsuario({ user_id: selectedUserId, fecha_inicio: fechaInicio, fecha_fin: fechaFin, tipo_jornada: cantidadDias > 1 ? 'completa' : tipoJornada, motivo });
        toast({ message: 'Permiso registrado correctamente', type: 'success' });
      }
      navigate('/gestion-permisos');
    } catch (err: any) { setError(err.response?.data?.message || 'Error al registrar'); }
    finally { setLoading(false); }
  };

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-4">Registrar Permiso para Trabajador</h1>
      <div className="flex bg-gray-100 rounded-lg p-1 mb-6">
        <button type="button" onClick={() => setTipoPermiso('administrativo')} className={`flex-1 py-2 text-sm font-medium rounded-md ${tipoPermiso === 'administrativo' ? 'bg-white shadow text-primary-700' : 'text-gray-600'}`}>Administrativo</button>
        <button type="button" onClick={() => setTipoPermiso('matrimonio')} className={`flex-1 py-2 text-sm font-medium rounded-md flex items-center justify-center gap-1.5 ${tipoPermiso === 'matrimonio' ? 'bg-white shadow text-pink-700' : 'text-gray-600'}`}><Heart className="w-4 h-4" /> Matrimonio (5 días)</button>
      </div>
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-4">
        <div className="relative">
          <label className="block text-sm font-medium mb-1">Trabajador</label>
          {selectedUser ? (
            <div className="flex items-center justify-between px-4 py-2 border rounded-lg bg-blue-50">
              <span className="text-sm font-medium text-blue-800">{selectedUser.nombres} {selectedUser.apellido_paterno} ({selectedUser.rut}-{selectedUser.dv})</span>
              <button type="button" onClick={() => { setSelectedUserId(''); setSearchTerm(''); }} className="text-blue-600 text-sm">Cambiar</button>
            </div>
          ) : (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" placeholder="Buscar por nombre o RUT..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setShowDropdown(true); }} onFocus={() => setShowDropdown(true)} className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
              {showDropdown && searchTerm && (
                <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {filteredUsuarios.length === 0 ? <div className="px-4 py-2 text-sm text-gray-500">Sin resultados</div> : filteredUsuarios.map((u) => (
                    <button key={u.id} type="button" onClick={() => { setSelectedUserId(u.id); setSearchTerm(''); setShowDropdown(false); }} className="w-full text-left px-4 py-2 text-sm hover:bg-blue-50">
                      <span className="font-medium">{u.nombres} {u.apellido_paterno}</span><span className="text-gray-500 ml-2">{u.rut}-{u.dv}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Fecha Inicio</label>
          <input type="date" value={fechaInicio} onChange={(e) => { setFechaInicio(e.target.value); setError(''); }} className={`w-full px-4 py-2 border rounded-lg outline-none ${(isWeekend(fechaInicio) || feriados.includes(fechaInicio)) ? 'border-red-500' : ''}`} required />
          {isWeekend(fechaInicio) && <p className="text-red-500 text-xs mt-1">No puede ser fin de semana</p>}
          {!isWeekend(fechaInicio) && feriados.includes(fechaInicio) && <p className="text-red-500 text-xs mt-1">Corresponde a un feriado</p>}
        </div>
        {tipoPermiso === 'administrativo' ? (
          <>
            <div>
              <label className="block text-sm font-medium mb-1">Cantidad de Días (máx. {MAX_PERMISOS})</label>
              <input type="number" min={1} max={MAX_PERMISOS} value={cantidadDias} onChange={(e) => setCantidadDias(Math.min(MAX_PERMISOS, Math.max(1, parseInt(e.target.value) || 1)))} className="w-full px-4 py-2 border rounded-lg outline-none" required />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Fecha Fin</label>
              <input type="date" value={fechaFin} readOnly className="w-full px-4 py-2 border rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed" />
            </div>
            {cantidadDias === 1 && (
              <div>
                <label className="block text-sm font-medium mb-1">Tipo de Jornada</label>
                <select value={tipoJornada} onChange={(e) => setTipoJornada(e.target.value as 'completa' | 'media')} className="w-full px-4 py-2 border rounded-lg outline-none">
                  <option value="completa">Jornada Completa</option>
                  <option value="media">Media Jornada</option>
                </select>
              </div>
            )}
          </>
        ) : (
          <>
            <div>
              <label className="block text-sm font-medium mb-1">Fecha Fin (5 días hábiles)</label>
              <input type="date" value={fechaFin} readOnly className="w-full px-4 py-2 border rounded-lg bg-pink-50 text-pink-800 font-medium cursor-not-allowed" />
              <p className="text-xs text-gray-500 mt-1">Mismo cálculo que administrativo (salta finde/feriado).</p>
            </div>
            <div className="bg-pink-50 text-pink-700 px-4 py-2 rounded-lg text-sm">5 días hábiles, jornada completa.</div>
          </>
        )}
        <div>
          <label className="block text-sm font-medium mb-1">Motivo</label>
          <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={4} className="w-full px-4 py-2 border rounded-lg outline-none" required />
        </div>
        {error && <div className="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm">{error}</div>}
        <button type="submit" disabled={loading || !selectedUserId} className={`w-full py-2 text-white font-medium rounded-lg disabled:opacity-50 flex items-center justify-center gap-2 ${tipoPermiso === 'matrimonio' ? 'bg-pink-600 hover:bg-pink-700' : 'bg-primary-600 hover:bg-primary-700'}`}>
          {loading ? 'Registrando...' : <><Send className="w-4 h-4" /> {tipoPermiso === 'matrimonio' ? 'Registrar Matrimonio' : 'Registrar Permiso'}</>}
        </button>
      </form>
    </div>
  );
}
