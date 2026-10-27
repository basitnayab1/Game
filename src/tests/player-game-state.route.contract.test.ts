import { strict as assert } from 'node:assert';
import { createApiRouter } from '../backend/src/routes/index.js';
const stack=(createApiRouter() as any).stack.map((x:any)=>x.route?.path).filter(Boolean);
assert.ok(stack.includes('/games/favorites')); assert.ok(stack.includes('/games/favorites/:gameId')); assert.ok(stack.includes('/games/recently-played'));
assert.ok(!stack.includes('/games/favorites/:gameId/credit'));
console.log('player game state route contract: PASS');
