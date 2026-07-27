exports.up = (pgm) => {
  pgm.createTable('roles', {
    id: 'id',
    nombre: { type: 'varchar(50)', notNull: true, unique: true },
    descripcion: { type: 'text' },
    created_at: { type: 'timestamp', default: pgm.func('now()') },
    updated_at: { type: 'timestamp', default: pgm.func('now()') },
  });
};

exports.down = (pgm) => {
  pgm.dropTable('roles');
};
