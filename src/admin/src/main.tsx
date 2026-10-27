import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

type Entry = { key: string; value: unknown; valueType: 'boolean' | 'string' | 'number' | 'json'; sensitive: boolean; version: number };
type Overview = { total_users: number; active_users: number; kyc_review_queue: number; open_risk_flags: number; open_support: number; active_game_sessions: number; active_admins: number };
type Vip = { level: number; name: string; tier: string; progressTargetMinor: number | null; dailySalaryMinor: number | null; monthlySalaryMinor: number | null; nextLevelBonusMinor: number | null; benefits: string[]; active: boolean };
type User = { id: string; phone_e164: string; status: string; username?: string; display_name?: string; kyc_status: string; cnic_number?: string | null; full_name?: string | null; document_type?: string | null; document_front?: string | null; document_back?: string | null; open_risk_flags: number };
type Ticket = { id: string; user_id: string; category: string; status: string; subject: string; user_label: string; updated_at: string };
type Provider = { id: string; name: string; externalProviderId?: string; status: string; isAuthorized: boolean; isFeatured: boolean; game_count: number };
type Promotion = { id: string; title: string; promotionType: string; status: string; startsAt: string; endsAt: string; config: Record<string, unknown> };
type RewardConfig = { id: string; cycleType: string; title: string; rewardConfig: Record<string, unknown>; status: string; startsAt?: string; endsAt?: string };
type Game = { id: string; providerId: string; externalGameId: string; name: string; category: string; status: string; artworkUrl?: string; isHot: boolean; isNew: boolean; isFeatured: boolean; displayOrder: number; providerName: string; providerStatus: string; providerAuthorized: boolean };

type AdminDeposit = {
  transactionId: string;
  depositId: string;
  userId: string;
  userPhone: string;
  amountMinor: string;
  amountPkr: number;
  currency: string;
  status: string;
  method: string;
  trxId: string;
  verifiedAt: string | null;
  createdAt: string;
  metadata: any;
};

type AdminWithdrawal = {
  transactionId: string;
  withdrawalId: string;
  userId: string;
  userPhone: string;
  amountMinor: string;
  amountPkr: number;
  status: string;
  gateway: string;
  accountPhone: string;
  accountTitle: string;
  createdAt: string;
  metadata: any;
};

type WhatsAppStatus = {
  channel: string;
  senderNumber: string;
  gatewayConfigured: boolean;
  costPerOtp: string;
  totalDispatched: number;
  history: Array<{ recipient: string; otpCode: string; timestamp: string; status: string; costPkr: number }>;
};

const API = (import.meta.env.VITE_API_BASE_URL ?? '/api/v1').replace(/\/$/, '');

async function request(path: string, init?: RequestInit) {
  const token = localStorage.getItem('n5_admin_token') ?? '';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((init?.headers as Record<string, string>) ?? {}),
  };
  const r = await fetch(`${API}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });
  const b = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (r.status === 401 || r.status === 403) {
      if (token) {
        localStorage.removeItem('n5_admin_token');
        window.dispatchEvent(new Event('n5-admin-logout'));
      }
    }
    throw new Error(b?.error?.message ?? b?.error?.code ?? `Request failed (${r.status})`);
  }
  return b.data;
}

function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('n5_admin_token'));
  const [adminPhone, setAdminPhone] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  const [tab, setTab] = useState<'overview' | 'users' | 'kyc' | 'whatsapp' | 'support' | 'games' | 'providers' | 'promotions' | 'rewards' | 'vip' | 'config' | 'deposits' | 'withdrawals'>('overview');
  const [waStatus, setWaStatus] = useState<WhatsAppStatus | null>(null);
  const [testPhone, setTestPhone] = useState('+923076975507');
  const [testResult, setTestResult] = useState('');
  const [providers, setProviders] = useState<Provider[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [rewardConfigs, setRewardConfigs] = useState<RewardConfig[]>([]);
  const [deposits, setDeposits] = useState<AdminDeposit[]>([]);
  const [withdrawals, setWithdrawals] = useState<AdminWithdrawal[]>([]);
  const [error, setError] = useState('');
  const [vipLevels, setVipLevels] = useState<Vip[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Entry | null>(null);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    const onLogout = () => setToken(null);
    window.addEventListener('n5-admin-logout', onLogout);
    return () => window.removeEventListener('n5-admin-logout', onLogout);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoggingIn(true);
    setLoginError('');
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: adminPhone, password: adminPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Login failed');
      localStorage.setItem('n5_admin_token', data.accessToken);
      setToken(data.accessToken);
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoggingIn(false);
    }
  };

  const run = async (fn: () => Promise<void>) => {
    setLoading(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  const loadOverview = () => run(async () => setOverview(await request('/admin/overview')));
  const loadUsers = () => run(async () => setUsers(await request(`/admin/users${search ? `?q=${encodeURIComponent(search)}` : ''}`)));
  const loadTickets = () => run(async () => setTickets(await request('/admin/support/tickets')));
  const loadProviders = () => run(async () => setProviders(await request('/admin/providers')));
  const loadGames = () => run(async () => setGames(await request('/admin/games')));
  const loadConfig = () => run(async () => setEntries(await request('/admin/config')));
  const loadPromotions = () => run(async () => setPromotions(await request('/admin/promotions')));
  const loadRewardConfigs = () => run(async () => setRewardConfigs(await request('/admin/reward-configs')));
  const loadVip = () => run(async () => setVipLevels(await request('/admin/vip/levels')));
  const loadDeposits = () => run(async () => setDeposits(await request('/admin/financial/deposits')));
  const loadWithdrawals = () => run(async () => setWithdrawals(await request('/admin/financial/withdrawals')));
  const loadWhatsApp = () => run(async () => setWaStatus(await request('/admin/whatsapp/status')));

  const handleTestWhatsApp = async () => {
    run(async () => {
      setTestResult('Sending WhatsApp OTP...');
      const res = await request('/admin/whatsapp/test', {
        method: 'POST',
        body: JSON.stringify({ phone: testPhone }),
      });
      setTestResult(`✓ Dispatched OTP ${res.otpCode} to ${res.phone} (Cost: Rs 0.00 PKR)`);
      await loadWhatsApp();
    });
  };

  useEffect(() => {
    if (token) void loadOverview();
  }, [token]);

  useEffect(() => {
    if (!token) return;
    if (tab === 'users' || tab === 'kyc') void loadUsers();
    if (tab === 'whatsapp') void loadWhatsApp();
    if (tab === 'support') void loadTickets();
    if (tab === 'games') void loadGames();
    if (tab === 'providers') void loadProviders();
    if (tab === 'promotions') void loadPromotions();
    if (tab === 'rewards') void loadRewardConfigs();
    if (tab === 'vip') void loadVip();
    if (tab === 'config') void loadConfig();
    if (tab === 'deposits') void loadDeposits();
    if (tab === 'withdrawals') void loadWithdrawals();
  }, [tab, token]);

  const handleApproveDeposit = async (txId: string) => {
    if (!confirm('Approve this deposit and credit player wallet?')) return;
    await run(async () => {
      await request(`/admin/financial/deposits/${txId}/approve`, { method: 'POST' });
      await loadDeposits();
    });
  };

  const handleRejectDeposit = async (txId: string) => {
    const reason = prompt('Reason for rejection:', 'Invalid TRX / Unverified transfer');
    if (reason === null) return;
    await run(async () => {
      await request(`/admin/financial/deposits/${txId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
      await loadDeposits();
    });
  };

  const handleApproveWithdrawal = async (txId: string) => {
    const payoutRef = prompt('Payout transfer reference / TRX ID:', 'PAID_' + Date.now());
    if (payoutRef === null) return;
    await run(async () => {
      await request(`/admin/financial/withdrawals/${txId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ payoutRef }),
      });
      await loadWithdrawals();
    });
  };

  const handleRejectWithdrawal = async (txId: string) => {
    const reason = prompt('Reason for rejection (funds will be refunded to player):', 'Verification failed');
    if (reason === null) return;
    await run(async () => {
      await request(`/admin/financial/withdrawals/${txId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
      await loadWithdrawals();
    });
  };

  const saveConfig = async () => {
    if (!selected) return;
    await run(async () => {
      let value: unknown = draft;
      if (selected.valueType === 'boolean') value = draft === 'true';
      else if (selected.valueType === 'number') value = Number(draft);
      else if (selected.valueType === 'json') value = JSON.parse(draft);
      await request('/admin/config', { method: 'PATCH', body: JSON.stringify({ key: selected.key, value, valueType: selected.valueType }) });
      setSelected(null);
      await loadConfig();
    });
  };

  const reviewKyc = async (u: User, status: string) => run(async () => {
    await request(`/admin/users/${u.id}/kyc`, { method: 'PATCH', body: JSON.stringify({ status }) });
    await loadUsers();
    await loadOverview();
  });

  const updateProvider = async (p: Provider, patch: Partial<Provider>) => run(async () => {
    await request(`/admin/providers/${p.id}`, { method: 'PATCH', body: JSON.stringify(patch) });
    await loadProviders();
  });

  const updateGame = async (g: Game, patch: Partial<Game>) => run(async () => {
    await request(`/admin/games/${g.id}`, { method: 'PATCH', body: JSON.stringify(patch) });
    await loadGames();
  });

  const supportStatus = async (t: Ticket, status: string) => run(async () => {
    await request(`/admin/support/tickets/${t.id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
    await loadTickets();
  });

  if (!token) {
    return (
      <div className="shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#0a0e17' }}>
        <div style={{ maxWidth: '420px', width: '100%', padding: '32px', background: '#131a26', borderRadius: '12px', border: '1px solid #1e293b' }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <h1 style={{ fontSize: '24px', margin: '0 0 6px 0', color: '#f8fafc' }}>N5 GAME ADMIN</h1>
            <p style={{ color: '#94a3b8', fontSize: '13px', margin: 0 }}>Two-Operator Secure Administrative Access</p>
          </div>
          {loginError && <div className="error" style={{ marginBottom: '16px' }}>{loginError}</div>}
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>Operator Phone</label>
              <input
                type="text"
                value={adminPhone}
                onChange={(e) => setAdminPhone(e.target.value)}
                placeholder="+92300..."
                style={{ width: '100%', padding: '10px 12px', background: '#0b0f17', border: '1px solid #334155', borderRadius: '6px', color: '#fff', boxSizing: 'border-box' }}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>Operator Password</label>
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="••••••••"
                style={{ width: '100%', padding: '10px 12px', background: '#0b0f17', border: '1px solid #334155', borderRadius: '6px', color: '#fff', boxSizing: 'border-box' }}
                required
              />
            </div>
            <button
              type="submit"
              disabled={loggingIn}
              style={{ marginTop: '8px', padding: '12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
            >
              {loggingIn ? 'Authenticating Operator...' : 'Sign In as Admin'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="shell">
      <aside>
        <div className="brand">
          <span>N5</span>
          <small>GAME ADMIN</small>
        </div>
        <nav>
          {[
            ['overview', 'Overview'],
            ['deposits', '💳 Deposits (Cashier)'],
            ['withdrawals', '💸 Withdrawals'],
            ['users', 'Users'],
            ['kyc', 'KYC & Risk'],
            ['whatsapp', '🟢 WhatsApp & SMS OTP'],
            ['support', 'Support'],
            ['games', 'Games'],
            ['providers', 'Providers'],
            ['promotions', 'Promotions'],
            ['rewards', 'Rewards'],
            ['vip', 'VIP'],
            ['config', 'Configuration'],
          ].map(([id, label]) => (
            <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id as typeof tab)}>
              {label}
            </button>
          ))}
        </nav>
        <div className="operator">
          <strong>2-Operator Mode</strong>
          <span>Maximum active admins: 2</span>
          <span>Every admin action is audited.</span>
        </div>
      </aside>
      <main>
        <header>
          <div>
            <h1>
              {tab === 'overview'
                ? 'N5 Overview'
                : tab === 'deposits'
                ? 'Deposit Requests (Cashier)'
                : tab === 'withdrawals'
                ? 'Withdrawal Requests'
                : tab === 'users'
                ? 'Users'
                : tab === 'kyc'
                ? 'KYC & Risk'
                : tab === 'whatsapp'
                ? 'Free WhatsApp OTP Gateway'
                : tab === 'support'
                ? 'Support'
                : tab === 'games'
                ? 'Games'
                : tab === 'providers'
                ? 'Providers'
                : tab === 'promotions'
                ? 'Promotions'
                : tab === 'rewards'
                ? 'Rewards'
                : tab === 'vip'
                ? 'VIP'
                : 'Configuration'}
            </h1>
            <p>Two authorized operators · full operational visibility</p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() =>
                tab === 'overview'
                  ? void loadOverview()
                  : tab === 'deposits'
                  ? void loadDeposits()
                  : tab === 'withdrawals'
                  ? void loadWithdrawals()
                  : tab === 'users' || tab === 'kyc'
                  ? void loadUsers()
                  : tab === 'whatsapp'
                  ? void loadWhatsApp()
                  : tab === 'support'
                  ? void loadTickets()
                  : tab === 'games'
                  ? void loadGames()
                  : tab === 'providers'
                  ? void loadProviders()
                  : tab === 'promotions'
                  ? void loadPromotions()
                  : tab === 'rewards'
                  ? void loadRewardConfigs()
                  : tab === 'vip'
                  ? void loadVip()
                  : void loadConfig()
              }
            >
              Refresh
            </button>
            <button
              onClick={() => {
                localStorage.removeItem('n5_admin_token');
                setToken(null);
              }}
              style={{ background: '#334155', color: '#fff', border: 'none', borderRadius: '6px', padding: '8px 14px', cursor: 'pointer' }}
            >
              Logout
            </button>
          </div>
        </header>
        {error && <div className="error">{error}</div>}
        {loading && <div className="loading">Loading…</div>}
        {tab === 'overview' && overview && (
          <div className="stats">
            {[
              ['Users', overview.total_users],
              ['Active Users', overview.active_users],
              ['KYC Queue', overview.kyc_review_queue],
              ['Open Risk', overview.open_risk_flags],
              ['Support', overview.open_support],
              ['Active Sessions', overview.active_game_sessions],
              ['Active Admins', overview.active_admins],
            ].map(([a, b]) => (
              <div className="stat" key={String(a)}>
                <small>{a}</small>
                <strong>{b}</strong>
              </div>
            ))}
          </div>
        )}
        {tab === 'users' && (
          <section>
            <div className="toolbar">
              <input placeholder="Search phone / username / name" value={search} onChange={(e) => setSearch(e.target.value)} />
              <button onClick={() => void loadUsers()}>Search</button>
            </div>
            <div className="table">
              {users.map((u) => (
                <div className="row" key={u.id}>
                  <div>
                    <strong>{u.full_name || u.username || u.display_name || u.phone_e164}</strong>
                    <small>{u.phone_e164} • ID: {u.id}</small>
                  </div>
                  <span>Status: {u.status}</span>
                  <span style={{ color: u.kyc_status === 'verified' ? '#10b981' : u.kyc_status === 'in_progress' ? '#f59e0b' : '#94a3b8' }}>
                    KYC: {u.kyc_status.toUpperCase()}
                  </span>
                  <span>Risk: {u.open_risk_flags}</span>
                </div>
              ))}
            </div>
          </section>
        )}
        {tab === 'kyc' && (
          <section>
            <div style={{ background: '#1e293b', padding: '14px 18px', borderRadius: '10px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong style={{ color: '#38bdf8', fontSize: '15px' }}>Manual Operator Review (100% Free Unlimited)</strong>
                <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: '12px' }}>
                  Review player CNIC document submissions. Approve or reject with a single click — no third-party verification fees.
                </p>
              </div>
              <div style={{ background: '#0f172a', padding: '6px 14px', borderRadius: '8px', border: '1px solid #334155' }}>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>Queue: </span>
                <strong style={{ color: '#f59e0b' }}>
                  {users.filter((u) => u.kyc_status === 'in_progress' || u.kyc_status === 'additional_information_required').length} Pending
                </strong>
              </div>
            </div>
            <div className="toolbar">
              <input placeholder="Search CNIC / phone / name" value={search} onChange={(e) => setSearch(e.target.value)} />
              <button onClick={() => void loadUsers()}>Search</button>
            </div>
            <div style={{ display: 'grid', gap: '14px' }}>
              {users
                .filter((u) => !search || (u.phone_e164 + (u.full_name ?? '') + (u.cnic_number ?? '')).toLowerCase().includes(search.toLowerCase()))
                .map((u) => (
                  <div
                    key={u.id}
                    className="card"
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '14px',
                      borderLeft: `4px solid ${
                        u.kyc_status === 'verified'
                          ? '#10b981'
                          : u.kyc_status === 'rejected'
                          ? '#ef4444'
                          : u.kyc_status === 'in_progress'
                          ? '#f59e0b'
                          : '#475569'
                      }`,
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                        <strong style={{ fontSize: '17px', color: '#fff' }}>{u.full_name || u.display_name || 'Player'}</strong>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '6px',
                            background:
                              u.kyc_status === 'verified'
                                ? '#065f46'
                                : u.kyc_status === 'rejected'
                                ? '#7f1d1d'
                                : u.kyc_status === 'in_progress'
                                ? '#854d0e'
                                : '#334155',
                            color: '#fff',
                            textTransform: 'uppercase',
                          }}
                        >
                          {u.kyc_status === 'in_progress' ? 'Pending Review' : u.kyc_status.replace('_', ' ')}
                        </span>
                        <span style={{ background: '#0b0f17', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', color: '#94a3b8' }}>
                          {u.document_type ? u.document_type.toUpperCase() : 'CNIC'}
                        </span>
                      </div>
                      <div style={{ color: '#94a3b8', fontSize: '13px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                        <span>Phone: <b style={{ color: '#fff' }}>{u.phone_e164}</b></span>
                        <span>CNIC / ID: <code style={{ color: '#38bdf8', fontWeight: 700, fontSize: '13px' }}>{u.cnic_number || '—'}</code></span>
                        <span>User ID: <code style={{ color: '#64748b' }}>{u.id}</code></span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {u.kyc_status !== 'verified' && (
                        <button
                          style={{ background: '#10b981', color: '#000', fontWeight: 700, border: 'none', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer' }}
                          onClick={() => void reviewKyc(u, 'verified')}
                        >
                          ✓ Approve CNIC
                        </button>
                      )}
                      {u.kyc_status !== 'rejected' && (
                        <button
                          style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer' }}
                          onClick={() => void reviewKyc(u, 'rejected')}
                        >
                          ✕ Reject
                        </button>
                      )}
                      <select
                        value={u.kyc_status}
                        onChange={(e) => {
                          if (e.target.value) void reviewKyc(u, e.target.value);
                        }}
                        style={{ background: '#0b0f17', color: '#fff', border: '1px solid #334155', borderRadius: '6px', padding: '7px 10px' }}
                      >
                        <option value="in_progress">In Progress</option>
                        <option value="verified">Verified</option>
                        <option value="rejected">Rejected</option>
                        <option value="additional_information_required">More Info</option>
                        <option value="not_started">Reset</option>
                      </select>
                    </div>
                  </div>
                ))}
            </div>
          </section>
        )}
        {tab === 'whatsapp' && (
          <section>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '14px', marginBottom: '18px' }}>
              <div style={{ background: '#064e3b', border: '1px solid #059669', padding: '16px 20px', borderRadius: '12px' }}>
                <strong style={{ fontSize: '15px', color: '#6ee7b7' }}>1. Anti-Ban WhatsApp Verification</strong>
                <p style={{ margin: '6px 0 0', color: '#a7f3d0', fontSize: '12px', lineHeight: 1.5 }}>
                  Player initiates the chat via WhatsApp link (e.g. <code>VERIFY_N5_XXXXXX</code>). <b>100% Zero Ban Risk</b> & <b>Rs 0.00 Free</b>.
                </p>
              </div>
              <div style={{ background: '#1e1b4b', border: '1px solid #4338ca', padding: '16px 20px', borderRadius: '12px' }}>
                <strong style={{ fontSize: '15px', color: '#a5b4fc' }}>2. Pakistan Brand SMS Gateway</strong>
                <p style={{ margin: '6px 0 0', color: '#c7d2fe', fontSize: '12px', lineHeight: 1.5 }}>
                  VeevoTech / BrandSMS.pk integration with official PTA Masking (<code>N5GAME</code>). Carrier direct: ~Rs 0.80 / SMS, 0% ban risk.
                </p>
              </div>
            </div>

            <div className="stats" style={{ marginBottom: '20px' }}>
              <div className="stat">
                <small>WhatsApp Number</small>
                <strong style={{ fontSize: '17px', color: '#38bdf8' }}>{waStatus?.senderNumber || '+923076975507'}</strong>
              </div>
              <div className="stat">
                <small>SMS Masking (PTA)</small>
                <strong style={{ fontSize: '17px', color: '#818cf8' }}>N5GAME</strong>
              </div>
              <div className="stat">
                <small>WhatsApp Cost</small>
                <strong style={{ fontSize: '20px', color: '#10b981' }}>Rs 0.00 (FREE)</strong>
              </div>
              <div className="stat">
                <small>Brand SMS Cost</small>
                <strong style={{ fontSize: '20px', color: '#cbd5e1' }}>~Rs 0.80 / SMS</strong>
              </div>
            </div>

            <div className="card" style={{ marginBottom: '20px' }}>
              <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', color: '#f8fafc' }}>📱 Test Live WhatsApp OTP Dispatch</h3>
              <p style={{ color: '#94a3b8', fontSize: '13px', margin: '0 0 14px 0' }}>
                Enter any Pakistani WhatsApp number below to verify real-time zero-cost OTP delivery.
              </p>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  type="text"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="+923001234567"
                  style={{ flex: 1, minWidth: '220px', padding: '10px 14px', background: '#0b0f17', border: '1px solid #334155', borderRadius: '8px', color: '#fff' }}
                />
                <button
                  onClick={() => void handleTestWhatsApp()}
                  style={{ background: '#10b981', color: '#000', fontWeight: 700, padding: '10px 18px', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
                >
                  🚀 Send Test WhatsApp OTP (Free)
                </button>
              </div>
              {testResult && (
                <div style={{ marginTop: '12px', padding: '10px 14px', borderRadius: '8px', background: '#1e293b', color: '#38bdf8', fontSize: '13px', fontWeight: 600 }}>
                  {testResult}
                </div>
              )}
            </div>

            <div className="card">
              <h3 style={{ margin: '0 0 14px 0', fontSize: '16px', color: '#f8fafc' }}>📜 Live WhatsApp OTP Dispatch Log</h3>
              {(!waStatus?.history || waStatus.history.length === 0) ? (
                <div className="empty" style={{ color: '#64748b', fontSize: '13px' }}>No OTPs dispatched yet. Test above or register a player to see live dispatches.</div>
              ) : (
                <div style={{ display: 'grid', gap: '10px' }}>
                  {waStatus.history.map((h, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0b0f17', padding: '12px 16px', borderRadius: '8px', border: '1px solid #1e293b' }}>
                      <div>
                        <strong style={{ color: '#fff' }}>{h.recipient}</strong>
                        <span style={{ marginLeft: '12px', color: '#94a3b8', fontSize: '12px' }}>Time: {new Date(h.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <code style={{ background: '#1e293b', color: '#10b981', padding: '3px 8px', borderRadius: '4px', fontWeight: 700 }}>OTP: {h.otpCode}</code>
                        <span style={{ fontSize: '11px', color: '#6ee7b7', background: '#064e3b', padding: '2px 8px', borderRadius: '6px' }}>Rs 0.00</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}
        {tab === 'providers' && (
          <div className="table">
            {providers.map((p) => (
              <div className="row" key={p.id}>
                <div>
                  <strong>{p.name}</strong>
                  <small>{p.externalProviderId || p.id} · {p.game_count} games</small>
                </div>
                <span>{p.status}</span>
                <label>
                  Authorized <input type="checkbox" checked={p.isAuthorized} onChange={(e) => void updateProvider(p, { isAuthorized: e.target.checked })} />
                </label>
                <label>
                  Featured <input type="checkbox" checked={p.isFeatured} onChange={(e) => void updateProvider(p, { isFeatured: e.target.checked })} />
                </label>
                <button onClick={() => void updateProvider(p, { status: p.status === 'active' ? 'inactive' : 'active' })}>
                  {p.status === 'active' ? 'Disable' : 'Enable'}
                </button>
              </div>
            ))}
          </div>
        )}
        {tab === 'games' && (
          <div className="table">
            {games.map((g) => (
              <div className="row" key={g.id}>
                <div>
                  <strong>{g.name}</strong>
                  <small>{g.category} · {g.providerName}</small>
                </div>
                <span>{g.status}</span>
                <label>
                  HOT <input type="checkbox" checked={g.isHot} onChange={(e) => void updateGame(g, { isHot: e.target.checked })} />
                </label>
                <label>
                  NEW <input type="checkbox" checked={g.isNew} onChange={(e) => void updateGame(g, { isNew: e.target.checked })} />
                </label>
                <label>
                  Featured <input type="checkbox" checked={g.isFeatured} onChange={(e) => void updateGame(g, { isFeatured: e.target.checked })} />
                </label>
                <button onClick={() => void updateGame(g, { status: g.status === 'active' ? 'inactive' : 'active' })}>
                  {g.status === 'active' ? 'Disable' : 'Enable'}
                </button>
              </div>
            ))}
          </div>
        )}
        {tab === 'promotions' && (
          <div className="table">
            <div className="toolbar">
              <button
                onClick={() =>
                  void run(async () => {
                    const now = new Date();
                    await request('/admin/promotions', {
                      method: 'PUT',
                      body: JSON.stringify({
                        title: 'New Promotion',
                        promotionType: 'other',
                        status: 'draft',
                        startsAt: now.toISOString(),
                        endsAt: new Date(now.getTime() + 86400000).toISOString(),
                        config: {},
                      }),
                    });
                    await loadPromotions();
                  })
                }
              >
                New Promotion
              </button>
            </div>
            {promotions.map((p) => (
              <div className="row" key={p.id}>
                <div>
                  <strong>{p.title}</strong>
                  <small>{p.promotionType} · {new Date(p.startsAt).toLocaleString()} → {new Date(p.endsAt).toLocaleString()}</small>
                </div>
                <select
                  value={p.status}
                  onChange={(e) =>
                    void run(async () => {
                      await request('/admin/promotions', { method: 'PUT', body: JSON.stringify({ ...p, status: e.target.value }) });
                      await loadPromotions();
                    })
                  }
                >
                  {['draft', 'active', 'disabled', 'expired'].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}
        {tab === 'rewards' && (
          <div className="table">
            <div className="toolbar">
              <button
                onClick={() =>
                  void run(async () => {
                    await request('/admin/reward-configs', {
                      method: 'PUT',
                      body: JSON.stringify({ cycleType: 'weekly', title: 'Weekly Reward', rewardConfig: {}, status: 'active' }),
                    });
                    await loadRewardConfigs();
                  })
                }
              >
                Save Weekly
              </button>
              <button
                onClick={() =>
                  void run(async () => {
                    await request('/admin/reward-configs', {
                      method: 'PUT',
                      body: JSON.stringify({ cycleType: 'monthly', title: 'Monthly Reward', rewardConfig: {}, status: 'active' }),
                    });
                    await loadRewardConfigs();
                  })
                }
              >
                Save Monthly
              </button>
            </div>
            {rewardConfigs.map((r) => (
              <div className="row" key={r.id}>
                <div>
                  <strong>{r.title}</strong>
                  <small>{r.cycleType} · {JSON.stringify(r.rewardConfig)}</small>
                </div>
                <select
                  value={r.status}
                  onChange={(e) =>
                    void run(async () => {
                      await request('/admin/reward-configs', { method: 'PUT', body: JSON.stringify({ ...r, status: e.target.value }) });
                      await loadRewardConfigs();
                    })
                  }
                >
                  <option>active</option>
                  <option>inactive</option>
                </select>
              </div>
            ))}
          </div>
        )}
        {tab === 'vip' && (
          <div className="table">
            <div className="toolbar">
              <span>VIP 1–20 · configuration only · wallet/ledger cannot be edited here.</span>
            </div>
            {vipLevels.map((v) => (
              <div className="row" key={v.level}>
                <div>
                  <strong>{v.level}. {v.name}</strong>
                  <small>
                    {v.tier} · Daily {v.dailySalaryMinor === null ? '—' : (v.dailySalaryMinor / 100).toFixed(2)} · Monthly{' '}
                    {v.monthlySalaryMinor === null ? '—' : (v.monthlySalaryMinor / 100).toFixed(2)} · Next bonus{' '}
                    {v.nextLevelBonusMinor === null ? '—' : (v.nextLevelBonusMinor / 100).toFixed(2)}
                  </small>
                </div>
                <label>
                  Active{' '}
                  <input
                    type="checkbox"
                    checked={v.active}
                    onChange={(e) =>
                      void run(async () => {
                        await request(`/admin/vip/levels/${v.level}`, { method: 'PATCH', body: JSON.stringify({ active: e.target.checked }) });
                        await loadVip();
                      })
                    }
                  />
                </label>
                <button
                  onClick={() => {
                    const daily = window.prompt('Daily salary (PKR)', v.dailySalaryMinor === null ? '' : String(v.dailySalaryMinor / 100));
                    if (daily === null) return;
                    const monthly = window.prompt('Monthly salary (PKR)', v.monthlySalaryMinor === null ? '' : String(v.monthlySalaryMinor / 100));
                    if (monthly === null) return;
                    const bonus = window.prompt('Next-level bonus (PKR)', v.nextLevelBonusMinor === null ? '' : String(v.nextLevelBonusMinor / 100));
                    if (bonus === null) return;
                    void run(async () => {
                      await request(`/admin/vip/levels/${v.level}`, {
                        method: 'PATCH',
                        body: JSON.stringify({
                          dailySalaryMinor: Math.round(Number(daily) * 100),
                          monthlySalaryMinor: Math.round(Number(monthly) * 100),
                          nextLevelBonusMinor: Math.round(Number(bonus) * 100),
                        }),
                      });
                      await loadVip();
                    });
                  }}
                >
                  Edit Rewards
                </button>
                {v.level === 20 && <span>VIP20 Daily = 333</span>}
              </div>
            ))}
          </div>
        )}
        {tab === 'support' && (
          <div className="table">
            {tickets.map((t) => (
              <div className="row" key={t.id}>
                <div>
                  <strong>{t.subject}</strong>
                  <small>{t.user_label} · {t.category}</small>
                </div>
                <span>{t.status}</span>
                <select value={t.status} onChange={(e) => void supportStatus(t, e.target.value)}>
                  {['open', 'in_progress', 'waiting_for_user', 'resolved', 'closed', 'reopened'].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}
        {tab === 'deposits' && (
          <div style={{ display: 'grid', gap: '14px' }}>
            {deposits.length === 0 ? (
              <div className="card empty">No deposit requests recorded.</div>
            ) : (
              deposits.map((d) => (
                <div className="card" key={d.transactionId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                      <strong style={{ fontSize: '18px', color: '#10b981' }}>PKR {d.amountPkr.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: '6px',
                        background: d.status === 'completed' ? '#065f46' : d.status === 'rejected' ? '#7f1d1d' : '#854d0e',
                        color: '#fff',
                        textTransform: 'uppercase'
                      }}>
                        {d.status}
                      </span>
                      <span style={{ background: '#1e293b', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', color: '#94a3b8' }}>
                        {d.method.toUpperCase()}
                      </span>
                    </div>
                    <small style={{ color: '#94a3b8' }}>
                      Player: <b style={{ color: '#fff' }}>{d.userPhone}</b> • TRX: <code style={{ color: '#38bdf8' }}>{d.trxId}</code> • Time: {new Date(d.createdAt).toLocaleString()}
                    </small>
                  </div>
                  {d.status === 'pending' && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        style={{ background: '#10b981', color: '#000', fontWeight: 700, border: 'none' }}
                        onClick={() => void handleApproveDeposit(d.transactionId)}
                      >
                        ✓ Approve & Credit
                      </button>
                      <button
                        style={{ background: '#ef4444', color: '#fff', border: 'none' }}
                        onClick={() => void handleRejectDeposit(d.transactionId)}
                      >
                        ✕ Reject
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
        {tab === 'withdrawals' && (
          <div style={{ display: 'grid', gap: '14px' }}>
            {withdrawals.length === 0 ? (
              <div className="card empty">No withdrawal requests recorded.</div>
            ) : (
              withdrawals.map((w) => (
                <div className="card" key={w.transactionId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                      <strong style={{ fontSize: '18px', color: '#38bdf8' }}>PKR {w.amountPkr.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: '6px',
                        background: w.status === 'completed' ? '#065f46' : w.status === 'rejected' ? '#7f1d1d' : '#854d0e',
                        color: '#fff',
                        textTransform: 'uppercase'
                      }}>
                        {w.status}
                      </span>
                      <span style={{ background: '#1e293b', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', color: '#94a3b8' }}>
                        {w.gateway.toUpperCase()}
                      </span>
                    </div>
                    <small style={{ color: '#94a3b8' }}>
                      Player: <b style={{ color: '#fff' }}>{w.userPhone}</b> • Payout Phone: <code style={{ color: '#facc15' }}>{w.accountPhone}</code> {w.accountTitle ? `(${w.accountTitle})` : ''} • Time: {new Date(w.createdAt).toLocaleString()}
                    </small>
                  </div>
                  {w.status === 'pending' && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        style={{ background: '#3b82f6', color: '#fff', fontWeight: 700, border: 'none' }}
                        onClick={() => void handleApproveWithdrawal(w.transactionId)}
                      >
                        ✓ Mark Paid & Complete
                      </button>
                      <button
                        style={{ background: '#ef4444', color: '#fff', border: 'none' }}
                        onClick={() => void handleRejectWithdrawal(w.transactionId)}
                      >
                        ✕ Reject & Refund
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
        {tab === 'config' && (
          <div className="grid">
            {entries.map((e) => (
              <button
                className="card item"
                key={e.key}
                onClick={() => {
                  setSelected(e);
                  setDraft(e.valueType === 'json' ? JSON.stringify(e.value, null, 2) : String(e.value));
                }}
              >
                <div>
                  <strong>{e.key}</strong>
                  <small>v{e.version} · {e.valueType}</small>
                </div>
                <span>{e.valueType === 'boolean' ? String(e.value) : e.valueType === 'json' ? 'JSON' : String(e.value).slice(0, 60)}</span>
              </button>
            ))}
          </div>
        )}
        {selected && (
          <div className="overlay">
            <section className="modal">
              <h2>Edit {selected.key}</h2>
              <p>Server validation + audit logging apply.</p>
              <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={selected.valueType === 'json' ? 12 : 4} />
              <div className="actions">
                <button onClick={() => setSelected(null)}>Cancel</button>
                <button className="primary" onClick={() => void saveConfig()}>
                  Save
                </button>
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
