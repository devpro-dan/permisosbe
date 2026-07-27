exports.up = (pgm) => {
  pgm.createTable('permisos_administrativos', {
    id: 'id',
    user_id: { type: 'integer', notNull: true, references: 'users(id)', onDelete: 'CASCADE' },
    fecha_solicitud: { type: 'timestamp', notNull: true, default: pgm.func('now()') },
    fecha_inicio: { type: 'date', notNull: true },
    fecha_fin: { type: 'date' },
    tipo_jornada: {
      type: 'varchar(10)',
      notNull: true,
      check: "tipo_jornada IN ('completa', 'media')",
    },
    estado: {
      type: 'varchar(20)',
      notNull: true,
      default: 'en_revision',
      check: "estado IN ('en_revision', 'aprobado', 'rechazado')",
    },
    motivo: { type: 'text', notNull: true },
    motivo_rechazo: { type: 'text' },
    created_at: { type: 'timestamp', default: pgm.func('now()') },
    updated_at: { type: 'timestamp', default: pgm.func('now()') },
  });
  pgm.createIndex('permisos_administrativos', 'user_id');
};

exports.down = (pgm) => {
  pgm.dropTable('permisos_administrativos');
};
