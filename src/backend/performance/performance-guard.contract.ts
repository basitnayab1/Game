export interface PerformanceBudget {
  apiP95Ms: number;
  databaseP95Ms: number;
  requestTimeoutMs: number;
  maxPageSize: number;
}

export const N5_PERFORMANCE_BUDGET: PerformanceBudget = {
  apiP95Ms: 800,
  databaseP95Ms: 300,
  requestTimeoutMs: 10000,
  maxPageSize: 50,
};

export function assertPageSize(pageSize: number): void {
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > N5_PERFORMANCE_BUDGET.maxPageSize) {
    throw new Error('Invalid page size');
  }
}

export function assertTimeout(timeoutMs: number): void {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > N5_PERFORMANCE_BUDGET.requestTimeoutMs) {
    throw new Error('Invalid request timeout');
  }
}
