exports.up = (pgm) => {
  pgm.addColumns('users', {
    can_change_password: { type: 'boolean', notNull: true, default: true },
  });
};

exports.down = (pgm) => {
  pgm.dropColumns('users', ['can_change_password']);
};
