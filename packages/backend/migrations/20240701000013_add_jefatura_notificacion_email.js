exports.up = async (pgm) => {
  pgm.sql(`
    INSERT INTO system_config (clave, valor, descripcion)
    VALUES ('jefatura_notificacion_email', '', 'Correo de jefatura para notificaciones de permisos pendientes de revisión')
    ON CONFLICT (clave) DO NOTHING;
  `);
};

exports.down = async (pgm) => {
  pgm.sql(`DELETE FROM system_config WHERE clave = 'jefatura_notificacion_email';`);
};
