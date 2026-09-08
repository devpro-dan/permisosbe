exports.up = (pgm) => {
  pgm.addColumn('role_permissions', {
    can_approve: { type: 'boolean', default: false },
  });
};

exports.down = (pgm) => {
  pgm.dropColumn('role_permissions', 'can_approve');
};
