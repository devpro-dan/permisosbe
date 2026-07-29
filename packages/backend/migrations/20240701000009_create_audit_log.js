exports.up = (pgm) => {
  pgm.createTable('audit_log', {
    id: 'id',
    user_id: { type: 'integer', references: 'users(id)', onDelete: 'SET NULL' },
    username: { type: 'varchar(100)' },
    accion: { type: 'varchar(50)', notNull: true },
    entidad: { type: 'varchar(50)', notNull: true },
    entidad_id: { type: 'integer' },
    detalle: { type: 'text' },
    ip_address: { type: 'varchar(45)' },
    created_at: { type: 'timestamp', default: pgm.func('now()') },
  });

  pgm.createIndex('audit_log', 'created_at');
  pgm.createIndex('audit_log', 'user_id');
  pgm.createIndex('audit_log', 'entidad');
};

exports.down = (pgm) => {
  pgm.dropTable('audit_log');
};
