import { Database } from '@/storage/database';
import type { Pool, PoolConnection, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import * as mysql from 'mysql2/promise';

// Mock mysql2/promise module
jest.mock('mysql2/promise', () => ({
  createPool: jest.fn(),
}));

describe('Database - MySQL Implementation', () => {
  let database: Database;
  let mockPool: jest.Mocked<Pool>;
  let mockConnection: jest.Mocked<PoolConnection>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock connection
    mockConnection = {
      ping: jest.fn().mockResolvedValue(undefined),
      execute: jest.fn(),
      beginTransaction: jest.fn().mockResolvedValue(undefined),
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
      release: jest.fn(),
    } as unknown as jest.Mocked<PoolConnection>;

    // Create mock pool
    mockPool = {
      getConnection: jest.fn().mockResolvedValue(mockConnection),
      execute: jest.fn(),
      end: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<Pool>;

    // Setup createPool mock
    (mysql.createPool as jest.Mock).mockReturnValue(mockPool);
  });

  describe('connect()', () => {
    it('should successfully connect to MySQL with valid DATABASE_URL', async () => {
      database = new Database({
        databaseUrl: 'mysql://user:pass@localhost:3306/testdb',
      });

      await database.connect();

      // Verify pool was created
      expect(mysql.createPool).toHaveBeenCalledWith({
        uri: 'mysql://user:pass@localhost:3306/testdb',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
      });

      // Verify connection test
      expect(mockPool.getConnection).toHaveBeenCalled();
      expect(mockConnection.ping).toHaveBeenCalled();
      expect(mockConnection.release).toHaveBeenCalled();
    });

    it('should throw error with invalid DATABASE_URL', async () => {
      database = new Database({
        databaseUrl: 'mysql://user:pass@invalid-host:3306/testdb',
      });

      // Simulate connection failure
      mockConnection.ping.mockRejectedValue(new Error('Connection failed'));

      await expect(database.connect()).rejects.toThrow('Connection failed');
    });

    it('should throw error when pool creation fails', async () => {
      database = new Database({
        databaseUrl: 'invalid-url',
      });

      (mysql.createPool as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid connection string');
      });

      await expect(database.connect()).rejects.toThrow('Invalid connection string');
    });
  });

  describe('run()', () => {
    beforeEach(async () => {
      database = new Database({
        databaseUrl: 'mysql://user:pass@localhost:3306/testdb',
      });
      await database.connect();
    });

    it('should execute INSERT and return affected rows with lastInsertId', async () => {
      const mockResult: ResultSetHeader = {
        affectedRows: 1,
        insertId: 42,
        fieldCount: 0,
        info: '',
        serverStatus: 0,
        warningStatus: 0,
        changedRows: 0,
      };

      mockPool.execute.mockResolvedValue([mockResult, []]);

      const result = await database.run('INSERT INTO users (name) VALUES (?)', ['John']);

      expect(mockPool.execute).toHaveBeenCalledWith('INSERT INTO users (name) VALUES (?)', [
        'John',
      ]);
      expect(result).toEqual({
        changes: 1,
        lastID: 42,
      });
    });

    it('should execute UPDATE and return affected rows', async () => {
      const mockResult: ResultSetHeader = {
        affectedRows: 3,
        insertId: 0,
        fieldCount: 0,
        info: '',
        serverStatus: 0,
        warningStatus: 0,
        changedRows: 3,
      };

      mockPool.execute.mockResolvedValue([mockResult, []]);

      const result = await database.run('UPDATE users SET active = ? WHERE role = ?', [
        true,
        'admin',
      ]);

      expect(result).toEqual({
        changes: 3,
        lastID: 0,
      });
    });

    it('should execute DELETE and return affected rows', async () => {
      const mockResult: ResultSetHeader = {
        affectedRows: 2,
        insertId: 0,
        fieldCount: 0,
        info: '',
        serverStatus: 0,
        warningStatus: 0,
        changedRows: 0,
      };

      mockPool.execute.mockResolvedValue([mockResult, []]);

      const result = await database.run('DELETE FROM users WHERE id = ?', [5]);

      expect(result).toEqual({
        changes: 2,
        lastID: 0,
      });
    });

    it('should handle SQL errors gracefully', async () => {
      mockPool.execute.mockRejectedValue(new Error('Syntax error in SQL'));

      await expect(database.run('INVALID SQL', [])).rejects.toThrow('Syntax error in SQL');
    });
  });

  describe('all()', () => {
    beforeEach(async () => {
      database = new Database({
        databaseUrl: 'mysql://user:pass@localhost:3306/testdb',
      });
      await database.connect();
    });

    it('should execute SELECT and return all rows', async () => {
      const mockRows: RowDataPacket[] = [
        { id: 1, name: 'Alice', email: 'alice@example.com' },
        { id: 2, name: 'Bob', email: 'bob@example.com' },
      ] as RowDataPacket[];

      mockPool.execute.mockResolvedValue([mockRows, []]);

      const result = await database.all<{ id: number; name: string; email: string }>(
        'SELECT * FROM users WHERE active = ?',
        [true]
      );

      expect(mockPool.execute).toHaveBeenCalledWith('SELECT * FROM users WHERE active = ?', [true]);
      expect(result).toEqual(mockRows);
      expect(result).toHaveLength(2);
    });

    it('should return empty array when no rows found', async () => {
      mockPool.execute.mockResolvedValue([[], []]);

      const result = await database.all<{ id: number }>('SELECT * FROM users WHERE id = ?', [999]);

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should handle complex queries with joins', async () => {
      const mockRows: RowDataPacket[] = [
        { userId: 1, userName: 'Alice', postId: 10, postTitle: 'First Post' },
      ] as RowDataPacket[];

      mockPool.execute.mockResolvedValue([mockRows, []]);

      const result = await database.all(
        'SELECT u.id as userId, u.name as userName, p.id as postId, p.title as postTitle FROM users u JOIN posts p ON u.id = p.user_id',
        []
      );

      expect(result).toEqual(mockRows);
    });
  });

  describe('get()', () => {
    beforeEach(async () => {
      database = new Database({
        databaseUrl: 'mysql://user:pass@localhost:3306/testdb',
      });
      await database.connect();
    });

    it('should return first row when rows exist', async () => {
      const mockRows: RowDataPacket[] = [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ] as RowDataPacket[];

      mockPool.execute.mockResolvedValue([mockRows, []]);

      const result = await database.get<{ id: number; name: string }>(
        'SELECT * FROM users WHERE active = ?',
        [true]
      );

      expect(result).toEqual({ id: 1, name: 'Alice' });
    });

    it('should return null when no rows found', async () => {
      mockPool.execute.mockResolvedValue([[], []]);

      const result = await database.get<{ id: number }>('SELECT * FROM users WHERE id = ?', [999]);

      expect(result).toBeNull();
    });
  });

  describe('close()', () => {
    it('should properly end pool connection', async () => {
      database = new Database({
        databaseUrl: 'mysql://user:pass@localhost:3306/testdb',
      });
      await database.connect();

      await database.close();

      expect(mockPool.end).toHaveBeenCalled();
    });

    it('should handle close when pool is null', async () => {
      database = new Database({
        databaseUrl: 'mysql://user:pass@localhost:3306/testdb',
      });

      // Close without connecting
      await expect(database.close()).resolves.not.toThrow();
    });

    it('should set pool to null after closing', async () => {
      database = new Database({
        databaseUrl: 'mysql://user:pass@localhost:3306/testdb',
      });
      await database.connect();
      await database.close();

      // Second close should not throw
      await expect(database.close()).resolves.not.toThrow();
    });
  });

  describe('transaction()', () => {
    beforeEach(async () => {
      database = new Database({
        databaseUrl: 'mysql://user:pass@localhost:3306/testdb',
      });
      await database.connect();
    });

    it('should commit successful transaction', async () => {
      const transactionFn = jest.fn().mockResolvedValue({ success: true });

      const result = await database.transaction(transactionFn);

      expect(mockPool.getConnection).toHaveBeenCalled();
      expect(mockConnection.beginTransaction).toHaveBeenCalled();
      expect(transactionFn).toHaveBeenCalledWith(mockConnection);
      expect(mockConnection.commit).toHaveBeenCalled();
      expect(mockConnection.release).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    it('should rollback failed transaction', async () => {
      const error = new Error('Transaction failed');
      const transactionFn = jest.fn().mockRejectedValue(error);

      await expect(database.transaction(transactionFn)).rejects.toThrow('Transaction failed');

      expect(mockConnection.beginTransaction).toHaveBeenCalled();
      expect(mockConnection.rollback).toHaveBeenCalled();
      expect(mockConnection.commit).not.toHaveBeenCalled();
      expect(mockConnection.release).toHaveBeenCalled();
    });

    it('should release connection even if rollback fails', async () => {
      const error = new Error('Transaction failed');
      const transactionFn = jest.fn().mockRejectedValue(error);
      mockConnection.rollback.mockRejectedValue(new Error('Rollback failed'));

      await expect(database.transaction(transactionFn)).rejects.toThrow('Transaction failed');

      expect(mockConnection.release).toHaveBeenCalled();
    });
  });

  describe('Connection Pooling', () => {
    it('should reuse connections from pool', async () => {
      database = new Database({
        databaseUrl: 'mysql://user:pass@localhost:3306/testdb',
      });
      await database.connect();

      const mockRows: RowDataPacket[] = [{ id: 1 }] as RowDataPacket[];
      mockPool.execute.mockResolvedValue([mockRows, []]);

      // Execute multiple queries
      await database.all('SELECT * FROM users', []);
      await database.all('SELECT * FROM posts', []);
      await database.get('SELECT * FROM comments', []);

      // Pool's execute method should be called multiple times
      expect(mockPool.execute).toHaveBeenCalledTimes(3);

      // Verify pool was created with correct connection limit
      expect(mysql.createPool).toHaveBeenCalledWith(
        expect.objectContaining({
          connectionLimit: 10,
        })
      );
    });
  });
});
