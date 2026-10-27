enum FinancialStatus { pending, confirmed, failed, cancelled, reversed, locked, underReview, approved, processing, completed, rejected }

class FinancialState {
  final FinancialStatus status;
  final int amountMinor;
  final int feeMinor;
  final int netMinor;
  const FinancialState({required this.status, required this.amountMinor, this.feeMinor = 0, this.netMinor = 0});
}
