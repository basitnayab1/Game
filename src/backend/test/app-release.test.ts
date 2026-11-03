import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createApp } from '../src/app.js';

describe('GET /api/v1/app/android/latest', () => {
  const originalCwd = process.cwd();
  let dir = '';
  let server: Server;
  let url = '';

  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'n5-release-'));
    fs.mkdirSync(path.join(dir, 'downloads'));
    process.chdir(dir);
    server = createApp().listen(0);
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1/app/android/latest`;
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
    process.chdir(originalCwd);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const publish = (release: unknown) => fs.writeFileSync(path.join(dir, 'downloads/version.json'), JSON.stringify(release));

  it('is public and reports the published release', async () => {
    publish({ versionCode: 3, versionName: '1.0.1', sha256: 'A'.repeat(64), notes: 'Fixes' });
    const res = await fetch(url);
    expect(res.status).toBe(200);
    expect(((await res.json()) as any).data).toEqual({
      versionCode: 3, versionName: '1.0.1', sha256: 'a'.repeat(64), mandatory: false, notes: 'Fixes', apkUrl: '/download/android',
    });
  });

  it('reports nothing when no valid release is published', async () => {
    publish({ versionCode: 3, versionName: '1.0.1', sha256: 'not-a-hash' });
    expect((await fetch(url)).status).toBe(404);
  });
});
