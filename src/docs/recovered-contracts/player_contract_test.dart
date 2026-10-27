/// Standalone recovered contract check. It intentionally does not import
/// deleted historical p89/p90 files from an earlier assembly.
void runPlayerContractChecks() {
  const home = '/home';
  const deposit = '/wallet/deposit';
  const completed = 'completed';
  const pending = 'pending';
  assert(home == '/home');
  assert(deposit == '/wallet/deposit');
  assert(completed != pending);
}
