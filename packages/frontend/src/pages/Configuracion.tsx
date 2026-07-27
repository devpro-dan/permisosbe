import { useState, useEffect } from 'react';
import { configApi } from '../services/api';
import { SystemConfig } from '../types';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { toast } from '../components/Toast';
import { Save } from 'lucide-react';

const CONFIG_META: Record<string, { label: string; type: string; desc: string; group: string }> = {
  permisos_por_anio: { label: 'Permisos por Año', type: 'number', desc: 'Cantidad máxima de permisos administrativos por año', group: 'Sistema' },
  duracion_sesion_minutos: { label: 'Duración de Sesión (minutos)', type: 'number', desc: 'Duración máxima de la sesión de usuario en minutos', group: 'Sesión' },
  dias_acceso: { label: 'Días de Acceso', type: 'text', desc: 'Días de la semana permitidos (1=Lunes, 7=Domingo). Separar por comas. Ej: 1,2,3,4,5', group: 'Sesión' },
  smtp_host: { label: 'Host', type: 'text', desc: 'Ej: smtp.gmail.com', group: 'Correo SMTP' },
  smtp_port: { label: 'Puerto', type: 'number', desc: 'Ej: 587 (TLS) o 465 (SSL)', group: 'Correo SMTP' },
  smtp_user: { label: 'Usuario', type: 'text', desc: 'Dirección de correo para autenticación', group: 'Correo SMTP' },
  smtp_pass: { label: 'Contraseña de Aplicación', type: 'password', desc: 'Para Gmail, usar contraseña de aplicación de 16 dígitos', group: 'Correo SMTP' },
  smtp_from: { label: 'Correo Remitente', type: 'email', desc: 'Dirección que aparecerá como remitente', group: 'Correo SMTP' },
};

const GROUPS = ['Sistema', 'Sesión', 'Correo SMTP'];
const SMTP_KEYS = ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from'];

export default function Configuracion() {
  const [configs, setConfigs] = useState<SystemConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [savingSingle, setSavingSingle] = useState<string | null>(null);
  const [savingSmtp, setSavingSmtp] = useState(false);

  const load = async () => {
    try {
      const res = await configApi.list();
      setConfigs(res.data);
      const values: Record<string, string> = {};
      res.data.forEach((c: SystemConfig) => { values[c.clave] = c.valor; });
      setEditValues(values);
    } catch {
      toast({ message: 'Error al cargar configuración', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSaveSingle = async (clave: string) => {
    setSavingSingle(clave);
    try {
      const meta = CONFIG_META[clave];
      await configApi.set({ clave, valor: editValues[clave], descripcion: meta?.desc || '' });
      toast({ message: 'Configuración guardada correctamente', type: 'success' });
      load();
    } catch (err: any) {
      toast({ message: err.response?.data?.message || 'Error al guardar', type: 'error' });
    } finally {
      setSavingSingle(null);
    }
  };

  const handleSaveSmtp = async () => {
    setSavingSmtp(true);
    try {
      for (const clave of SMTP_KEYS) {
        const meta = CONFIG_META[clave];
        await configApi.set({ clave, valor: editValues[clave], descripcion: meta?.desc || '' });
      }
      toast({ message: 'Configuración SMTP guardada correctamente', type: 'success' });
      load();
    } catch (err: any) {
      toast({ message: err.response?.data?.message || 'Error al guardar configuración SMTP', type: 'error' });
    } finally {
      setSavingSmtp(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Configuración del Sistema</h1>

      <div className="space-y-8 max-w-2xl">
        {GROUPS.map((group) => {
          const groupConfigs = configs.filter((c) => CONFIG_META[c.clave]?.group === group);
          if (groupConfigs.length === 0) return null;

          if (group === 'Correo SMTP') {
            return (
              <div key={group}>
                <h2 className="text-lg font-semibold text-gray-700 mb-3 border-b pb-2">Correo SMTP</h2>
                <div className="bg-white rounded-lg shadow p-5">
                  <div className="grid gap-4">
                    {groupConfigs.map((config) => {
                      const meta = CONFIG_META[config.clave] || { label: config.clave, type: 'text', desc: '', group: '' };
                      return (
                        <div key={config.id}>
                          <label className="block font-medium text-gray-700 mb-1">{meta.label}</label>
                          <p className="text-xs text-gray-500 mb-1">{meta.desc}</p>
                          <input
                            type={meta.type}
                            value={editValues[config.clave] || ''}
                            placeholder={config.clave === 'smtp_pass' ? '• • • • • • • • • • • • • •' : ''}
                            onChange={(e) => setEditValues({ ...editValues, [config.clave]: e.target.value })}
                            className="w-full px-4 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          {config.clave === 'smtp_pass' && !editValues[config.clave] && (
                            <p className="text-xs text-amber-600 mt-1">Vacío = mantener contraseña actual</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <button
                    onClick={handleSaveSmtp}
                    disabled={savingSmtp}
                    className="flex items-center justify-center gap-2 mt-5 w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" /> {savingSmtp ? 'Guardando configuración SMTP...' : 'Guardar Configuración SMTP'}
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div key={group}>
              <h2 className="text-lg font-semibold text-gray-700 mb-3 border-b pb-2">{group}</h2>
              <div className="grid gap-4">
                {groupConfigs.map((config) => {
                  const meta = CONFIG_META[config.clave] || { label: config.clave, type: 'text', desc: config.descripcion || '', group: '' };
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
                          onClick={() => handleSaveSingle(config.clave)}
                          disabled={savingSingle === config.clave}
                          className="inline-flex items-center gap-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm disabled:opacity-50 whitespace-nowrap"
                        >
                          <Save className="w-3.5 h-3.5" /> {savingSingle === config.clave ? 'Guardando...' : 'Guardar'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
