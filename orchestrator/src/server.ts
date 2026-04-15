import { createServer } from 'http';
import { createApp } from './app';
import { config } from './config';
import { logger } from './utils/logger';
import { getMongoClient } from './db/mongo';
import { getRedisClient } from './db/redis';

async function bootstrap() {
  try {
    // Connect to databases first
    await getMongoClient();
    await getRedisClient();

    const app = createApp();
    const server = createServer(app);

    server.listen(config.port, () => {
      logger.info('Orchestrator server started', { port: config.port, env: config.nodeEnv });
    });
  } catch (error) {
    logger.error('Failed to start server:', { error: error instanceof Error ? error.message : String(error) });
    process.exit(1);
  }
}

bootstrap();
