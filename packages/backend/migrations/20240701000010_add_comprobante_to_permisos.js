exports.up = (pgm) => {
  pgm.addColumns('permisos_administrativos', {
    comprobante_url: { type: 'varchar(500)' },
  });
};

exports.down = (pgm) => {
  pgm.dropColumns('permisos_administrativos', ['comprobante_url']);
};
