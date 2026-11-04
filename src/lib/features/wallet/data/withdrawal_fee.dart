/// The platform's withdrawal fee, mirroring the server
/// (backend/src/modules/payments/withdrawal-fee.ts), which is the authority:
/// it charges this fee when the withdrawal is requested. Rate per Rs 1,000 by
/// the highest tier reached: up to 19,999 → 40, 20k → 45, 30k → 50, 40k → 55,
/// 50k–99,999 → 60, 100k → 90.
double withdrawalFee(double amount) {
  if (amount <= 0) return 0;
  final perThousand = amount >= 100000
      ? 90
      : amount >= 50000
          ? 60
          : amount >= 40000
              ? 55
              : amount >= 30000
                  ? 50
                  : amount >= 20000
                      ? 45
                      : 40;
  return (amount * perThousand / 1000 * 100).round() / 100;
}
