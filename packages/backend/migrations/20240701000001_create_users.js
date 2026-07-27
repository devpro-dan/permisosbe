exports.up = (pgm) => {
  pgm.createTable('users', {
    id: 'id',
    nombres: { type: 'varchar(100)', notNull: true },
    rut: { type: 'varchar(12)', notNull: true },
    dv: { type: 'char(1)', notNull: true },
    apellido_paterno: { type: 'varchar(100)', notNull: true },
    apellido_materno: { type: 'varchar(100)' },
    titulo: { type: 'varchar(100)' },
    cargo: { type: 'varchar(100)', notNull: true },
    email: { type: 'varchar(255)', notNull: true, unique: true },
    username: { type: 'varchar(50)', notNull: true, unique: true },
    password_hash: { type: 'varchar(255)', notNull: true },
    rol_id: { type: 'integer', references: 'roles(id)', onDelete: 'SET NULL' },
    is_suspended: { type: 'boolean', default: false },
    created_at: { type: 'timestamp', default: pgm.func('now()') },
    updated_at: { type: 'timestamp', default: pgm.func('now()') },
  });
};

exports.down = (pgm) => {
  pgm.dropTable('users');
};
