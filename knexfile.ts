import type { Knex } from 'knex';
import * as path from 'path';
import { getSecretOrEnv } from './src/utils/secrets.js';

// For CommonJS compatibility - __dirname is available in transpiled CommonJS
const __dirname = path.resolve();

/**
 * Knex configuration for Clack Track database management
 *
 * Supports multiple environments:
 * - development: SQLite file-based database
 * - test: SQLite in-memory database
 * - production: MySQL database (configurable via environment variables)
 */

const config: { [key: string]: Knex.Config } = {
  development: {
    client: 'sqlite3',
    connection: {
      filename: path.join(__dirname, 'data', 'clack-track-dev.sqlite'),
    },
    useNullAsDefault: true,
    migrations: {
      directory: path.join(__dirname, 'migrations'),
      extension: 'cjs',
      loadExtensions: ['.cjs'],
    },
    seeds: {
      directory: path.join(__dirname, 'seeds'),
      extension: 'ts',
      loadExtensions: ['.ts'],
    },
  },

  test: {
    client: 'sqlite3',
    connection: {
      filename: ':memory:',
    },
    useNullAsDefault: true,
    migrations: {
      directory: path.join(__dirname, 'migrations'),
      extension: 'cjs',
      loadExtensions: ['.cjs'],
    },
    seeds: {
      directory: path.join(__dirname, 'seeds'),
      extension: 'ts',
      loadExtensions: ['.ts'],
    },
  },

  production: {
    client: process.env.DATABASE_TYPE === 'mysql' ? 'mysql2' : 'sqlite3',
    connection:
      process.env.DATABASE_TYPE === 'mysql'
        ? {
            host: process.env.DATABASE_HOST || 'localhost',
            port: parseInt(process.env.DATABASE_PORT || '3306', 10),
            user: process.env.DATABASE_USER || 'root',
            password: getSecretOrEnv('database_password_v2', 'DATABASE_PASSWORD', ''),
            database: process.env.DATABASE_NAME || 'clack_track',
          }
        : {
            filename: path.join(__dirname, 'data', 'clack-track.sqlite'),
          },
    useNullAsDefault: process.env.DATABASE_TYPE !== 'mysql',
    migrations: {
      directory: path.join(__dirname, 'migrations'),
      extension: 'cjs',
      loadExtensions: ['.cjs'],
    },
    seeds: {
      directory: path.join(__dirname, 'seeds'),
      extension: 'ts',
      loadExtensions: ['.ts'],
    },
    pool: {
      min: 2,
      max: 10,
    },
  },
};

export default config;
