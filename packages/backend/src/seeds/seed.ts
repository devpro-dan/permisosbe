import bcrypt from 'bcryptjs';
import pool from '../config/database';

const sections = [
  'usuarios',
  'roles',
  'permisos_administrativos',
  'reportes',
  'configuracion',
  'sesiones',
];

async function seed() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const existingAdmin = await client.query('SELECT id FROM roles WHERE nombre = $1', ['admin']);
    if (existingAdmin.rows.length > 0) {
      console.log('Seed ya ejecutado anteriormente. Saliendo...');
      await client.query('ROLLBACK');
      return;
    }

    const adminRoleResult = await client.query(
      `INSERT INTO roles (nombre, descripcion) VALUES ($1, $2) RETURNING id`,
      ['admin', 'Superadministrador con acceso total al sistema']
    );
    const adminRoleId = adminRoleResult.rows[0].id;

    const jefaturaRoleResult = await client.query(
      `INSERT INTO roles (nombre, descripcion) VALUES ($1, $2) RETURNING id`,
      ['jefatura', 'Jefatura con capacidad de aprobar permisos']
    );
    const jefaturaRoleId = jefaturaRoleResult.rows[0].id;

    const trabajadorRoleResult = await client.query(
      `INSERT INTO roles (nombre, descripcion) VALUES ($1, $2) RETURNING id`,
      ['trabajador', 'Trabajador que puede solicitar permisos']
    );
    const trabajadorRoleId = trabajadorRoleResult.rows[0].id;

    for (const section of sections) {
      await client.query(
        `INSERT INTO role_permissions (rol_id, seccion, can_view, can_create, can_edit, can_delete)
         VALUES ($1, $2, true, true, true, true)`,
        [adminRoleId, section]
      );
    }

    const jefaturaPermissions = [
      { seccion: 'usuarios', view: true, create: false, edit: false, delete: false },
      { seccion: 'permisos_administrativos', view: true, create: false, edit: true, delete: true },
      { seccion: 'reportes', view: true, create: false, edit: false, delete: false },
    ];

    for (const perm of jefaturaPermissions) {
      await client.query(
        `INSERT INTO role_permissions (rol_id, seccion, can_view, can_create, can_edit, can_delete)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [jefaturaRoleId, perm.seccion, perm.view, perm.create, perm.edit, perm.delete]
      );
    }

    const trabajadorPermissions = [
      { seccion: 'permisos_administrativos', view: true, create: true, edit: false, delete: false },
      { seccion: 'reportes', view: true, create: false, edit: false, delete: false },
    ];

    for (const perm of trabajadorPermissions) {
      await client.query(
        `INSERT INTO role_permissions (rol_id, seccion, can_view, can_create, can_edit, can_delete)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [trabajadorRoleId, perm.seccion, perm.view, perm.create, perm.edit, perm.delete]
      );
    }

    const passwordHash = await bcrypt.hash('admin123', 10);
    await client.query(
      `INSERT INTO users (nombres, rut, dv, apellido_paterno, apellido_materno, cargo, email, username, password_hash, rol_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (username) DO NOTHING`,
      [
        'Administrador',
        '11111111',
        '1',
        'Sistema',
        '',
        'Administrador del Sistema',
        'admin@permisosbe.com',
        'admin',
        passwordHash,
        adminRoleId,
      ]
    );

    const configs = [
      { clave: 'permisos_por_anio', valor: '6', descripcion: 'Cantidad máxima de permisos administrativos por año laboral' },
      { clave: 'duracion_sesion_minutos', valor: '120', descripcion: 'Duración máxima de la sesión de usuario en minutos' },
      { clave: 'dias_acceso', valor: '1,2,3,4,5', descripcion: 'Días de la semana permitidos para acceder al sistema (1=Lunes, 7=Domingo)' },
    ];

    for (const config of configs) {
      await client.query(
        `INSERT INTO system_config (clave, valor, descripcion) VALUES ($1, $2, $3)
         ON CONFLICT (clave) DO NOTHING`,
        [config.clave, config.valor, config.descripcion]
      );
    }

    await client.query('COMMIT');
    console.log('Seed ejecutado exitosamente');
    console.log('- Roles creados: admin, jefatura, trabajador');
    console.log('- Usuario admin creado: admin / admin123');
    console.log('- Permisos por rol configurados');
    console.log('- Configuraciones por defecto creadas');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error ejecutando seed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
