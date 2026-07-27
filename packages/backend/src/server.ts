import { env } from './config/env';
import app from './index';

app.listen(env.PORT, () => {
  console.log(`Servidor corriendo en puerto ${env.PORT}`);
});
