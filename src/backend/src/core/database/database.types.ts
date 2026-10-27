export type DatabaseClient = {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
  transaction<T>(fn: (tx: DatabaseClient) => Promise<T>): Promise<T>;
};

export type DatabaseHealth = {
  ok: boolean;
  latencyMs?: number;
};
