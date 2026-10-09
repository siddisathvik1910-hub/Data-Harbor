import { config } from './config.js';
import { prisma } from './db.js';
import { createApp } from './app.js';

const app = createApp();
const server = app.listen(config.port, () => {
  console.log(`API listening on http://localhost:${config.port}`);
  console.log(`CORS allowed origins: ${config.adminOrigin}, ${config.userOrigin}`);
});

async function shutdown() {
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
