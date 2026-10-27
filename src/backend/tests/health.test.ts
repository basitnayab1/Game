import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';

describe('N5 backend foundation', () => {
  it('creates the Express application', () => {
    const app = createApp();
    expect(app).toBeDefined();
  });
});
