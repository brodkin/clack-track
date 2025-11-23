export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface LogRecord {
  id: string;
  level: LogLevel;
  message: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export class LogModel {
  // TODO: Implement database model methods
  async create(_log: Omit<LogRecord, 'id' | 'timestamp'>): Promise<LogRecord> {
    void _log;
    throw new Error('Not implemented');
  }

  async findRecent(_limit: number = 100, _level?: LogLevel): Promise<LogRecord[]> {
    void _limit;
    void _level;
    throw new Error('Not implemented');
  }

  async deleteOlderThan(_days: number): Promise<number> {
    void _days;
    throw new Error('Not implemented');
  }
}
