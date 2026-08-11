exports.up = (pgm) => {
  pgm.createTable('feriados', {
    id: 'id',
    fecha: { type: 'date', notNull: true, unique: true },
    descripcion: { type: 'text', notNull: true },
    created_at: { type: 'timestamp', default: pgm.func('now()') },
  });
  pgm.createIndex('feriados', 'fecha');

  pgm.sql(`
    INSERT INTO feriados (fecha, descripcion) VALUES
    ('2026-01-01', 'Año Nuevo (irrenunciable)'),
    ('2026-04-03', 'Viernes Santo'),
    ('2026-04-04', 'Sábado Santo'),
    ('2026-05-01', 'Día Nacional del Trabajo (irrenunciable)'),
    ('2026-05-21', 'Día de las Glorias Navales'),
    ('2026-06-21', 'Día Nacional de los Pueblos Indígenas'),
    ('2026-06-29', 'San Pedro y San Pablo'),
    ('2026-07-16', 'Día de la Virgen del Carmen'),
    ('2026-08-15', 'Asunción de la Virgen'),
    ('2026-09-18', 'Independencia Nacional (irrenunciable)'),
    ('2026-09-19', 'Día de las Glorias del Ejército (irrenunciable)'),
    ('2026-10-12', 'Encuentro de Dos Mundos'),
    ('2026-10-31', 'Día de las Iglesias Evangélicas y Protestantes'),
    ('2026-11-01', 'Día de Todos los Santos'),
    ('2026-12-08', 'Inmaculada Concepción'),
    ('2026-12-25', 'Navidad (irrenunciable)')
  `);
};

exports.down = (pgm) => {
  pgm.dropTable('feriados');
};
