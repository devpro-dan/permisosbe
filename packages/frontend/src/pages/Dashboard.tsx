import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { permisoApi } from '../services/api';
import { Disponibilidad } from '../types';
import { CalendarCheck, CalendarClock, CalendarX, CalendarDays, ClipboardList } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [disponibilidad, setDisponibilidad] = useState<Disponibilidad | null>(null);

  useEffect(() => {
    if (user?.rolId === 3) {
      permisoApi.misPermisos()
        .then((res) => setDisponibilidad(res.data.disponibilidad))
        .catch(() => {});
    }
  }, [user]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Dashboard</h1>
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-2">Bienvenido, {user?.nombres} {user?.apellido_paterno}</h2>
        <p className="text-gray-600">Seleccione una opción del menú lateral para comenzar.</p>
      </div>

      {user?.rolId === 3 && disponibilidad && (
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Mis Permisos Administrativos</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg shadow p-5 border-l-4 border-blue-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Permitidos por año</p>
                  <p className="text-3xl font-bold text-blue-600 mt-1">{disponibilidad.max}</p>
                </div>
                <CalendarDays className="w-10 h-10 text-blue-200" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-5 border-l-4 border-amber-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Usados</p>
                  <p className="text-3xl font-bold text-amber-600 mt-1">{disponibilidad.used}</p>
                </div>
                <CalendarCheck className="w-10 h-10 text-amber-200" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-5 border-l-4 border-emerald-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">Disponibles</p>
                  <p className={`text-3xl font-bold mt-1 ${disponibilidad.available > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {disponibilidad.available}
                  </p>
                </div>
                <CalendarClock className="w-10 h-10 text-emerald-200" />
              </div>
            </div>
          </div>

          <button
            onClick={() => navigate('/solicitar-permiso')}
            className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors text-sm"
          >
            <ClipboardList className="w-4 h-4" /> Solicitar Permiso
          </button>
        </div>
      )}
    </div>
  );
}
