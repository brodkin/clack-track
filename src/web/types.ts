// Placeholder types for web framework
// TODO: Replace with actual framework types (Express, Fastify, etc.)

export interface Request {
  params: Record<string, string>;
  query: Record<string, string>;
  body: unknown;
}

export interface Response {
  json(data: unknown): void;
  status(code: number): Response;
  send(data: unknown): void;
}
