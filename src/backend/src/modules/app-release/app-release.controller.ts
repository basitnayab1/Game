import fs from 'node:fs';
import path from 'node:path';
import type { Request, Response } from 'express';
import { env } from '../../config/env.js';

/**
 * The latest published Android build, read from downloads/version.json, which is
 * written next to downloads/N5-Game.apk when a release is published
 * (see tools/publish-apk.sh). The app compares versionCode with its own and
 * offers the update; the APK is verified against sha256 before installing.
 */
const versionFile = () => path.resolve(process.cwd(), 'downloads/version.json');

type Release = { versionCode: number; versionName: string; sha256: string; mandatory?: boolean; notes?: string };

function readRelease(): Release | null {
  try {
    const r = JSON.parse(fs.readFileSync(versionFile(), 'utf8')) as Release;
    if (!Number.isInteger(r.versionCode) || typeof r.versionName !== 'string' || !/^[a-f0-9]{64}$/i.test(r.sha256)) return null;
    return r;
  } catch {
    return null;
  }
}

export function getLatestAndroidRelease(_req: Request, res: Response) {
  const release = readRelease();
  res.setHeader('Cache-Control', 'no-cache');
  if (!release) {
    return res.status(404).json({ ok: false, error: { code: 'NO_RELEASE_PUBLISHED' } });
  }
  return res.json({
    ok: true,
    data: {
      versionCode: release.versionCode,
      versionName: release.versionName,
      sha256: release.sha256.toLowerCase(),
      mandatory: release.mandatory === true,
      notes: release.notes ?? '',
      apkUrl: '/download/android',
    },
  });
}

/** How players reach support (e.g. to reset a forgotten password). */
export function getSupportContact(_req: Request, res: Response) {
  const digits = (env.SUPPORT_WHATSAPP ?? '').replace(/[^\d]/g, '');
  return res.json({ ok: true, data: { whatsapp: digits ? `+${digits}` : null } });
}
