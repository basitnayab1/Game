class WalletSummary {
  final String currency;
  final int availableMinor;
  final int bonusMinor;
  final int pendingMinor;
  final int lockedMinor;
  final DateTime refreshedAt;

  const WalletSummary({
    required this.currency,
    required this.availableMinor,
    required this.bonusMinor,
    required this.pendingMinor,
    required this.lockedMinor,
    required this.refreshedAt,
  });

  factory WalletSummary.fromJson(Map<String, dynamic> json) {
    final value = WalletSummary(
      currency: json['currency'] as String,
      availableMinor: json['availableMinor'] as int,
      bonusMinor: json['bonusMinor'] as int,
      pendingMinor: json['pendingMinor'] as int,
      lockedMinor: json['lockedMinor'] as int,
      refreshedAt: DateTime.parse(json['refreshedAt'] as String),
    );
    if (value.currency != 'PKR' || [value.availableMinor, value.bonusMinor, value.pendingMinor, value.lockedMinor].any((v) => v < 0)) {
      throw const FormatException('Invalid wallet response');
    }
    return value;
  }
}
