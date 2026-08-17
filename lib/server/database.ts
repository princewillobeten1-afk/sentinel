import { env } from './env';
import { logger } from './logger';

interface DatabaseClient {
  query: (query: string, params?: unknown[]) => Promise<unknown>;
  close: () => Promise<void>;
}

let client: DatabaseClient | null = null;

export async function createDatabaseClient(): Promise<DatabaseClient> {
  if (client) {
    return client;
  }

  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured');
  }

  logger.info('Initializing database connection', { databaseUrl: env.DATABASE_URL });

  // TODO: Replace with a real database driver.
  client = {
    query: async (queryText: string) => {
      logger.debug('Mock database query', { queryText });
      return { rows: [] };
    },
    close: async () => {
      logger.info('Closing mock database connection');
    },
  };

  return client;
}

export async function getDatabaseClient(): Promise<DatabaseClient> {
  return createDatabaseClient();
}
