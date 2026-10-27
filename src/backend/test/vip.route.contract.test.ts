import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const root=process.cwd();
const routes=readFileSync(join(root,'src/routes/index.ts'),'utf8');
const migration=readFileSync(join(root,'../database/migrations/024_vip_system.sql'),'utf8');
const controller=readFileSync(join(root,'src/modules/vip_referral/vip.controller.ts'),'utf8');
test('VIP routes and schema are mounted safely',()=>{
 expect(routes).toContain("router.get('/vip', requireAuth, getVip)");
 expect(routes).toContain("router.get('/vip/levels/:level', requireAuth, getVipLevel)");
 expect(routes).toContain("router.get('/vip/rewards', requireAuth, getVipHistory)");
 expect(migration).toContain('CREATE TABLE IF NOT EXISTS vip_levels');
 expect(migration).toContain('CREATE TABLE IF NOT EXISTS user_vip');
 expect(migration).toContain('CREATE TABLE IF NOT EXISTS vip_reward_history');
 expect(migration).toContain("(20,'VIP 20','Royal'");
 expect(controller).toContain('DATABASE_NOT_CONFIGURED');
});
