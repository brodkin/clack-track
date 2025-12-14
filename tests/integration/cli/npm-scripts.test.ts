/**
 * Integration tests for database npm scripts
 * Tests that new db:* scripts are properly configured and executable
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'fs';
import { resolve } from 'path';

interface PackageJson {
  scripts: Record<string, string>;
}

describe('Database npm scripts', () => {
  const packageJsonPath = resolve(__dirname, '../../../package.json');
  const packageJsonContent = readFileSync(packageJsonPath, 'utf-8');
  const packageJson = JSON.parse(packageJsonContent) as PackageJson;

  describe('db:reset script', () => {
    it('should be defined in package.json', () => {
      expect(packageJson.scripts['db:reset']).toBeDefined();
      expect(packageJson.scripts['db:reset']).toContain('tsx src/cli/index.ts db:reset');
    });

    it('should use correct command structure', () => {
      const script = packageJson.scripts['db:reset'];

      // Verify command structure without executing
      expect(script).toMatch(/^tsx src\/cli\/index\.ts db:reset$/);
    });
  });

  describe('db:reset:seed script', () => {
    it('should be defined in package.json', () => {
      expect(packageJson.scripts['db:reset:seed']).toBeDefined();
      expect(packageJson.scripts['db:reset:seed']).toContain(
        'tsx src/cli/index.ts db:reset --seed'
      );
    });

    it('should include --seed flag', () => {
      expect(packageJson.scripts['db:reset:seed']).toContain('--seed');
    });
  });

  describe('db:migrate script', () => {
    it('should be defined in package.json', () => {
      expect(packageJson.scripts['db:migrate']).toBeDefined();
      expect(packageJson.scripts['db:migrate']).toContain('migrate:latest');
      expect(packageJson.scripts['db:migrate']).toContain('--knexfile knexfile.ts');
    });
  });

  describe('db:rollback script', () => {
    it('should be defined in package.json', () => {
      expect(packageJson.scripts['db:rollback']).toBeDefined();
      expect(packageJson.scripts['db:rollback']).toContain('migrate:rollback');
      expect(packageJson.scripts['db:rollback']).toContain('--knexfile knexfile.ts');
    });
  });

  describe('db:seed script', () => {
    it('should be defined in package.json', () => {
      expect(packageJson.scripts['db:seed']).toBeDefined();
      expect(packageJson.scripts['db:seed']).toContain('seed:run');
      expect(packageJson.scripts['db:seed']).toContain('--knexfile knexfile.ts');
    });
  });

  describe('Script naming conventions', () => {
    it('should follow existing db: namespace pattern', () => {
      const dbScripts = Object.keys(packageJson.scripts).filter(key => key.startsWith('db:'));

      expect(dbScripts).toContain('db:reset');
      expect(dbScripts).toContain('db:reset:seed');
      expect(dbScripts).toContain('db:migrate');
      expect(dbScripts).toContain('db:rollback');
      expect(dbScripts).toContain('db:seed');
    });

    it('should use tsx for TypeScript CLI commands', () => {
      expect(packageJson.scripts['db:reset']).toContain('tsx');
      expect(packageJson.scripts['db:reset:seed']).toContain('tsx');
    });

    it('should use knex CLI for migration commands', () => {
      expect(packageJson.scripts['db:migrate']).toContain('knex');
      expect(packageJson.scripts['db:rollback']).toContain('knex');
      expect(packageJson.scripts['db:seed']).toContain('knex');
    });
  });
});
