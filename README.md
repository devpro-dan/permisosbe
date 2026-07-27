# PermisosBE

Sistema de administración de permisos administrativos para trabajadores de una empresa. Permite gestionar solicitudes, aprobaciones, roles de usuario, y generar reportes.

## Stack Tecnológico

- **Frontend**: React + TypeScript + Tailwind CSS + Vite
- **Backend**: Express + TypeScript
- **Base de Datos**: PostgreSQL (migraciones con pg-migrate)
- **Autenticación**: JWT + 2FA (Google Authenticator)
- **Reportes**: PDFKit + ExcelJS
- **Correos**: Nodemailer (SMTP Gmail)

## Estructura del Proyecto (Monorepo)

```
permisosbe/
├── packages/
│   ├── backend/          # API Express
│   │   ├── migrations/   # Migraciones PostgreSQL
│   │   ├── src/
│   │   │   ├── config/       # Configuración (DB, env)
│   │   │   ├── controllers/  # Controladores
│   │   │   ├── middleware/    # Auth + permisos
│   │   │   ├── repositories/ # Acceso a datos
│   │   │   ├── routes/       # Rutas Express
│   │   │   ├── services/     # Lógica de negocio
│   │   │   ├── seeds/        # Seed inicial
│   │   │   └── types/        # Tipos TypeScript
│   │   └── ...
│   └── frontend/         # App React
│       ├── src/
│       │   ├── components/   # Componentes reutilizables
│       │   ├── contexts/     # AuthContext
│       │   ├── pages/        # Páginas
│       │   └── services/     # API client
│       └── ...
├── package.json          # Monorepo root
└── README.md
```

## Requisitos

- Node.js 18+
- PostgreSQL 14+
- npm

## Configuración Inicial

### 1. Clonar e instalar dependencias

```bash
git clone <repo-url>
cd permisosbe
npm install
```

### 2. Configurar base de datos

Crear la base de datos en PostgreSQL:

```bash
createdb permisosbe
```

### 3. Configurar variables de entorno

```bash
cp packages/backend/.env.example packages/backend/.env
```

Editar `packages/backend/.env` con los valores correspondientes:

```
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=permisosbe
DB_USER=postgres
DB_PASSWORD=postgres
JWT_SECRET=mi-secreto-super-seguro
JWT_EXPIRES_IN=2h
```

### 4. Ejecutar migraciones

```bash
npm run migrate:up -w @permisosbe/backend
```

### 5. Ejecutar seed (usuario inicial)

```bash
npm run seed -w @permisosbe/backend
```

Esto crea:
- Usuario admin: `admin` / `admin123`
- Roles: `admin`, `jefatura`, `trabajador`
- Permisos por rol
- Configuraciones por defecto

### 6. Iniciar en desarrollo

```bash
# Backend (puerto 3000)
npm run dev -w @permisosbe/backend

# Frontend (puerto 5173, en otra terminal)
npm run dev -w @permisosbe/frontend
```

## Roles y Permisos

| Rol | Acceso |
|---|---|
| **admin** | Acceso total a todas las secciones |
| **jefatura** | Ver usuarios, gestionar permisos (aprobar/rechazar), reportes |
| **trabajador** | Ver/crear sus propios permisos, reportes propios |

## API Endpoints

### Autenticación
- `POST /api/auth/login` - Iniciar sesión
- `POST /api/auth/refresh` - Refrescar token
- `GET /api/auth/profile` - Obtener perfil
- `POST /api/auth/2fa/setup` - Configurar 2FA
- `POST /api/auth/2fa/verify` - Verificar 2FA

### Usuarios (admin)
- `GET /api/usuarios` - Listar usuarios
- `POST /api/usuarios` - Crear usuario
- `PUT /api/usuarios/:id` - Actualizar usuario
- `PATCH /api/usuarios/:id/suspend` - Suspender/activar
- `DELETE /api/usuarios/:id` - Eliminar usuario

### Roles (admin)
- `GET /api/roles` - Listar roles
- `POST /api/roles` - Crear rol
- `PUT /api/roles/:id` - Actualizar rol
- `DELETE /api/roles/:id` - Eliminar rol
- `GET /api/roles/:id/permissions` - Ver permisos
- `POST /api/roles/:id/permissions` - Configurar permiso

### Permisos Administrativos
- `GET /api/permisos/mis-permisos` - Mis permisos (trabajador)
- `POST /api/permisos/solicitar` - Solicitar permiso (trabajador)
- `GET /api/permisos` - Todos los permisos (jefatura/admin)
- `GET /api/permisos/usuario/:userId` - Permisos por usuario
- `POST /api/permisos/:id/aprobar` - Aprobar permiso
- `POST /api/permisos/:id/rechazar` - Rechazar permiso
- `PUT /api/permisos/:id` - Editar permiso
- `DELETE /api/permisos/:id` - Eliminar permiso
- `GET /api/permisos/reporte/pdf` - PDF de mis permisos
- `GET /api/permisos/reporte/excel` - Excel de mis permisos

### Configuración (admin)
- `GET /api/config` - Listar configuraciones
- `POST /api/config` - Guardar configuración

### Sesiones (admin)
- `GET /api/sesiones` - Listar sesiones activas
- `DELETE /api/sesiones/:id` - Eliminar sesión

## Configuración de Correos SMTP

1. Ir a Configuración en el frontend (usuario admin)
2. Ingresar datos SMTP (Host, Puerto, Usuario, Contraseña, Email From)
3. Para Gmail: usar contraseña de aplicación (no la contraseña regular)

## Pruebas

```bash
# Backend
npm test -w @permisosbe/backend

# Frontend
npm test -w @permisosbe/frontend
```
