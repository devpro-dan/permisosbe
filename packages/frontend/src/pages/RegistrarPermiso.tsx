import { useState, useMemo, useEffect } from 'react';
import { permisoApi, userApi } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { toast } from '../components/Toast';
import { Send, Search } from 'lucide-react';
import { User } from '../types';
import { isWeekend, addBusinessDays } from '../utils/dates';

export default function RegistrarPermiso() {
  const navigate = useNavigate();
  const today = new Date().toISOString().split('T')[0];

  const [usuarios, setUsuarios] = useState<User[]>([]);
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

  const fechaFin = useMemo(() => addBusinessDays(fechaInicio, cantidadDias - 1), [fechaInicio, cantidadDias]);

  useEffect(() => {
    userApi.list().then((res) => setUsuarios(res.data)).catch(() => {});
  }, []);

  const filteredUsuarios = usuarios.filter((u) => {
    const fullName = `${u.nombres} ${u.apellido_paterno} ${u.apellido_materno || ''}`.toLowerCase();
    const rutFull = `${u.rut}-${u.dv}`;
    const term = searchTerm.toLowerCase();
    return fullName.includes(term) || rutFull.includes(term);
  });

  const selectedUser = usuarios.find((u) => u.id === selectedUserId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) {
      setError('Debes seleccionar un trabajador');
      return;
    }
    setError('');
    if (isWeekend(fechaInicio)) {
      setError('La fecha de inicio no puede ser fin de semana');
      return;
    }
    if (cantidadDias < 1 || cantidadDias > MAX_PERMISOS) {
      setError(`La cantidad de días debe estar entre 1 y ${MAX_PERMISOS}`);
      return;
    }
    setLoading(true);

    try {
      await permisoApi.registrarParaUsuario({
        user_id: selectedUserId,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        tipo_jornada: cantidadDias > 1 ? 'completa' : tipoJornada,
        motivo,
      });
      toast({ message: 'Permiso registrado correctamente', type: 'success' });
      navigate('/gestion-permisos');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al registrar permiso');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Registrar Permiso para Trabajador</h1>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-4">
        <div className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-1">Trabajador</label>
          {selectedUser ? (
            <div className="flex items-center justify-between px-4 py-2 border rounded-lg bg-blue-50">
              <span className="text-sm font-medium text-blue-800">
                {selectedUser.nombres} {selectedUser.apellido_paterno} ({selectedUser.rut}-{selectedUser.dv})
              </span>
              <button
                type="button"
                onClick={() => { setSelectedUserId(''); setSearchTerm(''); }}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                Cambiar
              </button>
            </div>
          ) : (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por nombre o RUT..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setShowDropdown(true); }}
                onFocus={() => setShowDropdown(true)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
              {showDropdown && searchTerm && (
                <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {filteredUsuarios.length === 0 ? (
                    <div className="px-4 py-2 text-sm text-gray-500">Sin resultados</div>
                  ) : (
                    filteredUsuarios.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => { setSelectedUserId(u.id); setSearchTerm(''); setShowDropdown(false); }}
                        className="w-full text-left px-4 py-2 text-sm hover:bg-blue-50 transition-colors"
                      >
                        <span className="font-medium">{u.nombres} {u.apellido_paterno}</span>
                        <span className="text-gray-500 ml-2">{u.rut}-{u.dv}</span>
                        <span className="text-gray-400 ml-2 text-xs">{u.cargo}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Inicio</label>
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => { setFechaInicio(e.target.value); setError(''); }}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none ${isWeekend(fechaInicio) ? 'border-red-500' : ''}`}
              required
            />
            {isWeekend(fechaInicio) && <p className="text-red-500 text-xs mt-1">La fecha de inicio no puede ser fin de semana</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad de Días (máx. {MAX_PERMISOS})</label>
          <input
            type="number"
            min={1}
            max={MAX_PERMISOS}
            value={cantidadDias}
            onChange={(e) => setCantidadDias(Math.min(MAX_PERMISOS, Math.max(1, parseInt(e.target.value) || 1)))}
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
          disabled={loading || !selectedUserId}
          className="flex items-center justify-center gap-2 w-full py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? 'Registrando...' : <><Send className="w-4 h-4" /> Registrar Permiso</>}
        </button>
      </form>
    </div>
  );
}
