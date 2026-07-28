import { createServer } from 'http';
import { env } from './config/env';
import app from './index';
import { initializeSocket } from './services/socket.service';

const server = createServer(app);
initializeSocket(server);

server.listen(env.PORT, () => {
  console.log(`Servidor corriendo en puerto ${env.PORT}`);
});
