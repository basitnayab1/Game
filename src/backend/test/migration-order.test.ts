import { readdirSync } from 'node:fs';
import { join } from 'node:path';

describe('database migration ordering', () => {
  it('contains a contiguous numeric migration chain', () => {
    const dir = join(process.cwd(), '..', 'database', 'migrations');
    const files = readdirSync(dir).filter((f) => /^\d+_.+\.sql$/.test(f)).sort();
    const numbers = files.map((f) => Number(f.split('_', 1)[0]));
    expect(numbers.length).toBeGreaterThan(0);
    expect(numbers).toEqual(Array.from({ length: numbers.length }, (_, i) => i + 1));
  });
});
