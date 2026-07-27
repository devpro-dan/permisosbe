exports.up = (pgm) => {
  pgm.createTable('system_config', {
    id: 'id',
    clave: { type: 'varchar(100)', notNull: true, unique: true },
    valor: { type: 'text', notNull: true },
    descripcion: { type: 'text' },
    created_at: { type: 'timestamp', default: pgm.func('now()') },
    updated_at: { type: 'timestamp', default: pgm.func('now()') },
  });
};

exports.down = (pgm) => {
  pgm.dropTable('system_config');
};
