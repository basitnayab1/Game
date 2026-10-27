import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';

const controller = readFileSync('backend/src/modules/games/game-launch.controller.ts', 'utf8');
const routes = readFileSync('backend/src/routes/index.ts', 'utf8');
assert.match(routes, /get\('\/games\/:gameId', requireAuth, getGameDetail\)/);
assert.match(routes, /post\('\/games\/:gameId\/launch', requireAuth, launchGame\)/);
assert.match(controller, /REAL_MONEY_GAME_LAUNCH_ENABLED/);
assert.match(controller, /AUTHORIZED_GAME_PROVIDER_READY/);
assert.match(controller, /AGE_NOT_ELIGIBLE/);
assert.match(controller, /KYC_NOT_VERIFIED/);
assert.match(controller, /PROVIDER_ADAPTER_NOT_CONFIGURED/);
assert.doesNotMatch(controller, /launchUrl\s*:/);
console.log('PASS games launch guard contract');
