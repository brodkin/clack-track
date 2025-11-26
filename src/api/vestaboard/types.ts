export type AnimationStrategy =
  | 'column'
  | 'reverse-column'
  | 'edges-to-center'
  | 'row'
  | 'diagonal'
  | 'random';

export interface AnimationOptions {
  strategy: AnimationStrategy;
  stepIntervalMs?: number;
  stepSize?: number;
}

export interface VestaboardClientConfig {
  apiKey: string;
  apiUrl?: string;
  timeoutMs?: number;
  maxRetries?: number;
}

export interface VestaboardClient {
  sendText(text: string): Promise<void>;
  sendLayout(layout: number[][]): Promise<void>;
  sendLayoutWithAnimation(layout: number[][], options: AnimationOptions): Promise<void>;
  readMessage(): Promise<number[][]>;
  validateConnection(): Promise<{ connected: boolean; latencyMs?: number }>;
}
