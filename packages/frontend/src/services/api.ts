import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

export const authApi = {
  login: (username: string, password: string, twoFactorToken?: string) =>
    api.post('/auth/login', { username, password, twoFactorToken }),
  refreshToken: (token: string) => api.post('/auth/refresh', { token }),
  getProfile: () => api.get('/auth/profile'),
  setup2FA: () => api.post('/auth/2fa/setup'),
  verify2FA: (token: string) => api.post('/auth/2fa/verify', { token }),
};

export const userApi = {
  list: () => api.get('/usuarios'),
  getById: (id: number) => api.get(`/usuarios/${id}`),
  create: (data: any) => api.post('/usuarios', data),
  update: (id: number, data: any) => api.put(`/usuarios/${id}`, data),
  suspend: (id: number, suspended: boolean) => api.patch(`/usuarios/${id}/suspend`, { suspended }),
  delete: (id: number) => api.delete(`/usuarios/${id}`),
};

export const roleApi = {
  list: () => api.get('/roles'),
  getById: (id: number) => api.get(`/roles/${id}`),
  create: (data: any) => api.post('/roles', data),
  update: (id: number, data: any) => api.put(`/roles/${id}`, data),
  delete: (id: number) => api.delete(`/roles/${id}`),
  getPermissions: (id: number) => api.get(`/roles/${id}/permissions`),
  setPermission: (id: number, data: any) => api.post(`/roles/${id}/permissions`, data),
};

export const permisoApi = {
  misPermisos: () => api.get('/permisos/mis-permisos'),
  solicitar: (data: any) => api.post('/permisos/solicitar', data),
  listarTodos: () => api.get('/permisos'),
  getByUserId: (userId: number) => api.get(`/permisos/usuario/${userId}`),
  update: (id: number, data: any) => api.put(`/permisos/${id}`, data),
  delete: (id: number) => api.delete(`/permisos/${id}`),
  aprobar: (id: number) => api.post(`/permisos/${id}/aprobar`),
  rechazar: (id: number, motivo_rechazo: string) => api.post(`/permisos/${id}/rechazar`, { motivo_rechazo }),
  reportePDF: (year?: number) => api.get('/permisos/reporte/pdf', { params: { year }, responseType: 'blob' }),
  reporteExcel: (year?: number) => api.get('/permisos/reporte/excel', { params: { year }, responseType: 'blob' }),
};

export const configApi = {
  list: () => api.get('/config'),
  getByClave: (clave: string) => api.get(`/config/${clave}`),
  set: (data: any) => api.post('/config', data),
};

export const sessionApi = {
  list: () => api.get('/sesiones'),
  delete: (id: number) => api.delete(`/sesiones/${id}`),
};
