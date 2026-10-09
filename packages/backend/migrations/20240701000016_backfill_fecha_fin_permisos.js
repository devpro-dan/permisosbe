exports.up = (pgm) => {
  pgm.sql(
    'UPDATE permisos_administrativos SET fecha_fin = fecha_inicio, updated_at = NOW() WHERE fecha_fin IS NULL'
  );
};

exports.down = () => {};
