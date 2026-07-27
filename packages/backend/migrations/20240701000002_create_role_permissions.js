exports.up = (pgm) => {
  pgm.createTable('role_permissions', {
    id: 'id',
    rol_id: { type: 'integer', notNull: true, references: 'roles(id)', onDelete: 'CASCADE' },
    seccion: { type: 'varchar(100)', notNull: true },
    can_view: { type: 'boolean', default: false },
    can_create: { type: 'boolean', default: false },
    can_edit: { type: 'boolean', default: false },
    can_delete: { type: 'boolean', default: false },
  });
  pgm.addConstraint('role_permissions', 'unique_rol_seccion', {
    unique: ['rol_id', 'seccion'],
  });
};

exports.down = (pgm) => {
  pgm.dropTable('role_permissions');
};
