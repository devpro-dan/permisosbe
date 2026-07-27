import { useState, useEffect } from 'react';
import { configApi } from '../services/api';
import { SystemConfig } from '../types';
import { LoadingSpinner } from '../components/LoadingSpinner';

const CONFIG_META: Record<string, { label: string; type: string; desc: string }> = {
  permisos_por_anio: { label: 'Permisos por Año', type: 'number', desc: 'Cantidad máxima de permisos administrativos por año' },
  duracion_sesion_minutos: { label: 'Duración de Sesión (minutos)', type: 'number', desc: 'Duración máxima de la sesión de usuario en minutos' },
  dias_acceso: { label: 'Días de Acceso', type: 'text', desc: 'Días de la semana permitidos (1=Lunes, 7=Domingo). Separar por comas. Ej: 1,2,3,4,5' },
  smtp_host: { label: 'SMTP Host', type: 'text', desc: 'Host del servidor SMTP' },
  smtp_port: { label: 'SMTP Puerto', type: 'number', desc: 'Puerto del servidor SMTP' },
  smtp_user: { label: 'SMTP Usuario', type: 'text', desc: 'Usuario de autenticación SMTP' },
  smtp_pass: { label: 'SMTP Contraseña', type: 'password', desc: 'Contraseña de autenticación SMTP' },
  smtp_from: { label: 'SMTP Email Desde', type: 'email', desc: 'Dirección de correo desde la que se enviarán los emails' },
};

export default function Configuracion() {
  const [configs, setConfigs] = useState<SystemConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await configApi.list();
      setConfigs(res.data);
      const values: Record<string, string> = {};
      res.data.forEach((c: SystemConfig) => { values[c.clave] = c.valor; });
      setEditValues(values);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (clave: string) => {
    setSaving(clave);
    try {
      const meta = CONFIG_META[clave];
      await configApi.set({ clave, valor: editValues[clave], descripcion: meta?.desc || '' });
      load();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al guardar');
    } finally {
      setSaving(null);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Configuración del Sistema</h1>

      <div className="grid gap-4 max-w-2xl">
        {configs.map((config) => {
          const meta = CONFIG_META[config.clave] || { label: config.clave, type: 'text', desc: config.descripcion || '' };
          return (
            <div key={config.id} className="bg-white rounded-lg shadow p-4">
              <label className="block font-medium text-gray-700 mb-1">{meta.label}</label>
              <p className="text-xs text-gray-500 mb-2">{meta.desc}</p>
              <div className="flex gap-2">
                <input
                  type={meta.type}
                  value={editValues[config.clave] || ''}
                  onChange={(e) => setEditValues({ ...editValues, [config.clave]: e.target.value })}
                  className="flex-1 px-4 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={() => handleSave(config.clave)}
                  disabled={saving === config.clave}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm disabled:opacity-50"
                >
                  {saving === config.clave ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
