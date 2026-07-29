export interface User {
  id: number;
  nombres: string;
  rut: string;
  dv: string;
  apellido_paterno: string;
  apellido_materno?: string;
  titulo?: string;
  cargo: string;
  email: string;
  username: string;
  rol_id: number;
  rol_nombre?: string;
  is_suspended: boolean;
  can_change_password: boolean;
  created_at: string;
}

export interface Role {
  id: number;
  nombre: string;
  descripcion?: string;
  permissions?: RolePermission[];
}

export interface RolePermission {
  id: number;
  rol_id: number;
  seccion: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

export interface Permiso {
  id: number;
  user_id: number;
  nombres?: string;
  apellido_paterno?: string;
  apellido_materno?: string;
  rut?: string;
  dv?: string;
  cargo?: string;
  fecha_solicitud: string;
  fecha_inicio: string;
  fecha_fin?: string;
  tipo_jornada: 'completa' | 'media';
  estado: 'en_revision' | 'aprobado' | 'rechazado';
  motivo: string;
  motivo_rechazo?: string;
  comprobante_url?: string;
}

export interface Disponibilidad {
  max: number;
  used: number;
  available: number;
}

export interface SystemConfig {
  id: number;
  clave: string;
  valor: string;
  descripcion?: string;
}

export interface AuditLog {
  id: number;
  user_id: number | null;
  username: string;
  accion: string;
  entidad: string;
  entidad_id: number | null;
  detalle: string | null;
  ip_address: string | null;
  created_at: string;
}

export interface Session {
  id: number;
  user_id: number;
  token: string;
  expires_at: string;
  last_activity: string;
  created_at: string;
  username?: string;
  nombres?: string;
  apellido_paterno?: string;
}

export interface AuthUser {
  id: number;
  nombres: string;
  apellido_paterno: string;
  email: string;
  username: string;
  rolId: number;
  can_change_password: boolean;
  permissions?: RolePermission[];
}
