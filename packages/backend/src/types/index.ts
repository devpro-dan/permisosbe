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
  password_hash: string;
  rol_id: number;
  is_suspended: boolean;
  can_change_password: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Role {
  id: number;
  nombre: string;
  descripcion?: string;
  created_at: Date;
  updated_at: Date;
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

export interface PermisoAdministrativo {
  id: number;
  user_id: number;
  fecha_solicitud: Date;
  fecha_inicio: string;
  fecha_fin?: string;
  tipo_jornada: 'completa' | 'media';
  estado: 'en_revision' | 'aprobado' | 'rechazado';
  motivo: string;
  motivo_rechazo?: string;
  comprobante_url?: string;
  created_at: Date;
  updated_at: Date;
}

export interface Session {
  id: number;
  user_id: number;
  token: string;
  expires_at: Date;
  last_activity: Date;
  created_at: Date;
}

export interface User2FA {
  id: number;
  user_id: number;
  secret: string;
  enabled: boolean;
  created_at: Date;
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
  created_at: Date;
}

export interface SystemConfig {
  id: number;
  clave: string;
  valor: string;
  descripcion?: string;
  created_at: Date;
  updated_at: Date;
}

export interface JwtPayload {
  userId: number;
  username: string;
  rolId: number;
}
