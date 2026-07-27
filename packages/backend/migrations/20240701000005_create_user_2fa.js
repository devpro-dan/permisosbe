exports.up = (pgm) => {
  pgm.createTable('user_2fa', {
    id: 'id',
    user_id: { type: 'integer', notNull: true, unique: true, references: 'users(id)', onDelete: 'CASCADE' },
    secret: { type: 'varchar(255)', notNull: true },
    enabled: { type: 'boolean', default: false },
    created_at: { type: 'timestamp', default: pgm.func('now()') },
  });
};

exports.down = (pgm) => {
  pgm.dropTable('user_2fa');
};
