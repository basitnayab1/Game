import { afterEach, describe, expect, it, vi } from 'vitest';
import { adminAlertsEnabled, sendAdminAlert } from '../src/modules/notifications/admin-alerts.js';

const saved = { ...process.env };

afterEach(() => {
  process.env = { ...saved };
  vi.unstubAllGlobals();
});

describe('admin email alerts', () => {
  it('sends nothing without a key or a recipient', async () => {
    delete process.env.RESEND_API_KEY;
    process.env.ADMIN_ALERT_EMAIL = 'owner@example.com';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(adminAlertsEnabled()).toBe(false);
    expect(await sendAdminAlert('x', [])).toBe(false);

    process.env.RESEND_API_KEY = 're_test';
    process.env.ADMIN_ALERT_EMAIL = 'not-an-email';
    expect(adminAlertsEnabled()).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts an escaped email to Resend', async () => {
    process.env.RESEND_API_KEY = 're_test';
    process.env.ADMIN_ALERT_EMAIL = 'a@example.com, b@example.com';
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => '' });
    vi.stubGlobal('fetch', fetchMock);

    expect(await sendAdminAlert('Withdrawal request: Rs 100', [['Account', '<script>x</script>']])).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.headers.Authorization).toBe('Bearer re_test');
    const body = JSON.parse(init.body);
    expect(body.to).toEqual(['a@example.com', 'b@example.com']);
    expect(body.from).toBe('N5 Alerts <no-reply@n5gamez.com>');
    expect(body.subject).toBe('[N5] Withdrawal request: Rs 100');
    expect(body.html).toContain('&lt;script&gt;');
    expect(body.html).not.toContain('<script>');
  });

  it('never throws when Resend fails', async () => {
    process.env.RESEND_API_KEY = 're_test';
    process.env.ADMIN_ALERT_EMAIL = 'a@example.com';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await sendAdminAlert('x', [])).toBe(false);
  });
});
