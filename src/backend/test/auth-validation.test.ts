import { describe, expect, it } from 'vitest';
import { assertAdult } from '../src/modules/auth/service.js';

describe('assertAdult', () => {
  const today = new Date(Date.UTC(2026, 10, 4));

  it('accepts players who are 18 or older', () => {
    expect(() => assertAdult('2008-11-04', today)).not.toThrow();
    expect(() => assertAdult('1990-01-01', today)).not.toThrow();
  });

  it('rejects players under 18', () => {
    expect(() => assertAdult('2008-11-05', today)).toThrow('UNDERAGE');
  });

  it('rejects dates that do not exist', () => {
    expect(() => assertAdult('2004-02-30', today)).toThrow('INVALID_DOB');
    expect(() => assertAdult('0000-01-01', today)).toThrow('INVALID_DOB');
  });
});
