import { useAuth } from '../contexts/AuthContext';

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Dashboard</h1>
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-2">Bienvenido, {user?.nombres} {user?.apellido_paterno}</h2>
        <p className="text-gray-600">Seleccione una opción del menú lateral para comenzar.</p>
      </div>
    </div>
  );
}
