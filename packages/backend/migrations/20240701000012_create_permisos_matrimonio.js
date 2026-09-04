exports.up = (pgm) => {
  pgm.createTable('permisos_matrimonio', {
    id: 'id',
    user_id: { type: 'integer', notNull: true, references: 'users(id)', onDelete: 'CASCADE' },
    fecha_solicitud: { type: 'timestamp', notNull: true, default: pgm.func('now()') },
    fecha_inicio: { type: 'date', notNull: true },
    fecha_fin: { type: 'date', notNull: true },
    estado: {
      type: 'varchar(20)',
      notNull: true,
      default: 'en_revision',
      check: "estado IN ('en_revision', 'aprobado', 'rechazado')",
    },
    motivo: { type: 'text', notNull: true },
    motivo_rechazo: { type: 'text' },
    comprobante_url: { type: 'text' },
    created_at: { type: 'timestamp', default: pgm.func('now()') },
    updated_at: { type: 'timestamp', default: pgm.func('now()') },
  });
  pgm.createIndex('permisos_matrimonio', 'user_id');
  pgm.createIndex('permisos_matrimonio', 'fecha_inicio');
};

exports.down = (pgm) => {
  pgm.dropTable('permisos_matrimonio');
};
