import { useState } from 'react';
import { permisoApi } from '../services/api';
import { useNavigate } from 'react-router-dom';

export default function SolicitarPermiso() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fecha_inicio: '',
    fecha_fin: '',
    tipo_jornada: 'completa' as 'completa' | 'media',
    motivo: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await permisoApi.solicitar(form);
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
            value={form.fecha_inicio}
            onChange={(e) => setForm({ ...form, fecha_inicio: e.target.value })}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Fin (opcional)</label>
          <input
            type="date"
            value={form.fecha_fin}
            onChange={(e) => setForm({ ...form, fecha_fin: e.target.value })}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Jornada</label>
          <select
            value={form.tipo_jornada}
            onChange={(e) => setForm({ ...form, tipo_jornada: e.target.value as 'completa' | 'media' })}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="completa">Jornada Completa</option>
            <option value="media">Media Jornada</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Motivo</label>
          <textarea
            value={form.motivo}
            onChange={(e) => setForm({ ...form, motivo: e.target.value })}
            rows={4}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            required
          />
        </div>

        {error && <div className="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm">{error}</div>}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? 'Solicitando...' : 'Solicitar Permiso'}
        </button>
      </form>
    </div>
  );
}
