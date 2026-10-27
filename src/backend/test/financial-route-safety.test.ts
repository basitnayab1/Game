import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const routes = readFileSync(resolve(process.cwd(), 'src/routes/index.ts'), 'utf8');
const controller = readFileSync(resolve(process.cwd(), 'src/modules/wallet/wallet.controller.ts'), 'utf8');

describe('financial route safety gate', () => {
  it('does not mount deposit/withdrawal or example ledger mutation endpoints', () => {
    expect(routes).not.toMatch(/deposit|withdrawal|validateExampleLedgerInput/i);
    expect(controller).not.toMatch(/validateExampleLedgerInput/);
  });

  it('keeps wallet reads fail-closed until a repository is configured', () => {
    expect(controller).toMatch(/WALLET_REPOSITORY_NOT_CONFIGURED/);
    expect(controller).toMatch(/status\(503\)/);
  });
});
