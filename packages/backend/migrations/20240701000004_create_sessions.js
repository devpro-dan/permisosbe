exports.up = (pgm) => {
  pgm.createTable('sessions', {
    id: 'id',
    user_id: { type: 'integer', notNull: true, references: 'users(id)', onDelete: 'CASCADE' },
    token: { type: 'varchar(500)', notNull: true },
    expires_at: { type: 'timestamp', notNull: true },
    last_activity: { type: 'timestamp', default: pgm.func('now()') },
    created_at: { type: 'timestamp', default: pgm.func('now()') },
  });
  pgm.createIndex('sessions', 'user_id');
  pgm.createIndex('sessions', 'token');
};

exports.down = (pgm) => {
  pgm.dropTable('sessions');
};
