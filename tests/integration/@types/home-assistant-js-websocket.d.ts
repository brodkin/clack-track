/**
 * Custom type declarations for home-assistant-js-websocket
 * Used only in integration tests for type-safe mocking
 */

declare module 'home-assistant-js-websocket' {
  export interface Connection {
    addEventListener?(eventType: string, listener: (event: unknown) => void): void;
    removeEventListener?(eventType: string, listener: (event: unknown) => void): void;
    close(): void;
  }

  export interface AuthData {
    access_token: string;
    [key: string]: unknown;
  }

  export function createConnection(options: { auth: AuthData }): Promise<Connection>;
  export function createLongLivedTokenAuth(url: string, token: string): AuthData;
  export function getStates(connection: Connection): Promise<unknown[]>;
  export function callService(
    connection: Connection,
    domain: string,
    service: string,
    serviceData?: Record<string, unknown>
  ): Promise<unknown>;
}
