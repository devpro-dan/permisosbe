import axios from 'axios';

const apiUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, '') || '';

const api = axios.create({
  baseURL: `${apiUrl}/api`,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRedirecting = false;

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !isRedirecting) {
      const errorCode = error.response?.data?.code;
      const currentPath = window.location.pathname;
      
      if (errorCode === 'SESSION_CLOSED' || errorCode === 'SESSION_EXPIRED') {
        isRedirecting = true;
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        alert(error.response?.data?.message || 'Tu sesión ha expirado');
        window.location.href = '/login';
        setTimeout(() => { isRedirecting = false; }, 2000);
      } else if (currentPath !== '/login' && currentPath !== '/reset-password') {
        isRedirecting = true;
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        setTimeout(() => { isRedirecting = false; }, 2000);
      }
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
  changeMyPassword: (currentPassword: string, newPassword: string) =>
    api.post('/auth/change-password', { currentPassword, newPassword }),
  forgotPassword: (email: string) =>
    api.post('/auth/forgot-password', { email }),
  resetPassword: (token: string, newPassword: string) =>
    api.post('/auth/reset-password', { token, newPassword }),
};

export const userApi = {
  list: () => api.get('/usuarios'),
  getById: (id: number) => api.get(`/usuarios/${id}`),
  create: (data: any) => api.post('/usuarios', data),
  update: (id: number, data: any) => api.put(`/usuarios/${id}`, data),
  suspend: (id: number, suspended: boolean) => api.patch(`/usuarios/${id}/suspend`, { suspended }),
  changePassword: (id: number, password: string) => api.post(`/usuarios/${id}/change-password`, { password }),
  get2FAStatus: (id: number) => api.get(`/usuarios/${id}/2fa`),
  setup2FA: (id: number) => api.post(`/usuarios/${id}/2fa/setup`),
  verify2FA: (id: number, token: string) => api.post(`/usuarios/${id}/2fa/verify`, { token }),
  disable2FA: (id: number) => api.delete(`/usuarios/${id}/2fa`),
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
  registrarParaUsuario: (data: any) => api.post('/permisos/registrar-para-usuario', data),
  listarTodos: () => api.get('/permisos'),
  getByUserId: (userId: number) => api.get(`/permisos/usuario/${userId}`),
  update: (id: number, data: any) => api.put(`/permisos/${id}`, data),
  delete: (id: number) => api.delete(`/permisos/${id}`),
  aprobar: (id: number) => api.post(`/permisos/${id}/aprobar`),
  rechazar: (id: number, motivo_rechazo: string) => api.post(`/permisos/${id}/rechazar`, { motivo_rechazo }),
  reportePDF: (year?: number) => api.post('/permisos/reporte/pdf', { year }, { responseType: 'blob' }),
  reporteExcel: (year?: number) => api.post('/permisos/reporte/excel', { year }, { responseType: 'blob' }),
  reporteConsulta: (params: Record<string, string | number>) => api.post('/permisos/reporte/consulta', params),
  reporteGeneralPDF: (params: Record<string, string | number>) => api.post('/permisos/reporte/general/pdf', params, { responseType: 'blob' }),
  reporteGeneralExcel: (params: Record<string, string | number>) => api.post('/permisos/reporte/general/excel', params, { responseType: 'blob' }),
  reporteTrabajadores: (params: Record<string, string | number>) => api.post('/permisos/reporte/trabajadores', params),
  reporteTrabajadoresPDF: (params: Record<string, string | number>) => api.post('/permisos/reporte/trabajadores/pdf', params, { responseType: 'blob' }),
  reporteTrabajadoresExcel: (params: Record<string, string | number>) => api.post('/permisos/reporte/trabajadores/excel', params, { responseType: 'blob' }),
  reporteOficio: (month: string, ord?: string) => api.post('/permisos/reporte/oficio', { month, ord }, { responseType: 'blob' }),
  certificado: (id: number) => api.get(`/permisos/${id}/certificado`, { responseType: 'blob' }),
  subirComprobante: (id: number, file: File) => {
    const formData = new FormData();
    formData.append('comprobante', file);
    return api.post(`/permisos/${id}/comprobante`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  descargarComprobante: (id: number) => api.get(`/permisos/${id}/comprobante`, { responseType: 'blob' }),
};

export const configApi = {
  list: () => api.get('/config'),
  getByClave: (clave: string) => api.get(`/config/${clave}`),
  set: (data: any) => api.post('/config', data),
  testEmail: (email: string) => api.post('/config/test-email', { email }),
};

export const auditLogApi = {
  list: (params?: Record<string, string | number>) => api.post('/audit-log', params),
};

export const sessionApi = {
  list: () => api.get('/sesiones'),
  deleteAll: () => api.delete('/sesiones'),
  delete: (id: number) => api.delete(`/sesiones/${id}`),
};
