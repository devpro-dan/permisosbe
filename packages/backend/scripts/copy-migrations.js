const { cpSync } = require('fs');
const { join } = require('path');

cpSync(
  join(process.cwd(), 'migrations'),
  join(process.cwd(), 'dist', 'migrations'),
  { recursive: true, force: true }
);
