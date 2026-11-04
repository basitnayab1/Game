import 'package:flutter_test/flutter_test.dart';
import 'package:n5_game/features/auth/presentation/register_screen.dart';
import 'package:n5_game/features/wallet/data/withdrawal_fee.dart';

void main() {
  test('withdrawal fee matches the agreed table and the server', () {
    const table = {10000: 400, 20000: 900, 30000: 1500, 40000: 2200, 50000: 3000, 100000: 9000};
    table.forEach((amount, fee) => expect(withdrawalFee(amount.toDouble()), fee.toDouble()));
    expect(withdrawalFee(500), 20);
    expect(withdrawalFee(15000), 600);
    expect(withdrawalFee(75000), 4500);
  });

  test('date of birth must be at least 18 years ago', () {
    final today = DateTime(2026, 11, 4);
    expect(isAdult('2008-11-04', today: today), isTrue);
    expect(isAdult('2008-11-05', today: today), isFalse);
    expect(isAdult('not a date', today: today), isFalse);
  });
}
