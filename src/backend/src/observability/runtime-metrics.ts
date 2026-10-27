export type RuntimeMetrics = {
  startedAt: string;
  requests: number;
  errors: number;
};

const metrics: RuntimeMetrics = { startedAt: new Date().toISOString(), requests: 0, errors: 0 };

export function recordRequest(statusCode: number): void {
  metrics.requests += 1;
  if (statusCode >= 500) metrics.errors += 1;
}

export function readRuntimeMetrics(): RuntimeMetrics {
  return { ...metrics };
}
