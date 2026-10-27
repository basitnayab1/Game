import 'package:flutter_test/flutter_test.dart';
import 'package:n5_game/features/vip/data/vip_api.dart';

void main() {
  test('VipLevelItem and VipSummary handle string and numeric values from Postgres', () {
    final rawLevel = {
      'level': 20,
      'name': 'VIP 20',
      'tier': 'Royal',
      'progressTargetMinor': null,
      'dailySalaryMinor': '33300', // String from Postgres bigint
      'monthlySalaryMinor': null,
      'nextLevelBonusMinor': null,
      'benefits': ['Royal VIP badge'],
    };

    final item = VipLevelItem.fromJson(rawLevel);
    expect(item.level, 20);
    expect(item.name, 'VIP 20');
    expect(item.dailySalaryMinor, 33300);

    final rawSummary = {
      'level': 0,
      'name': 'VIP 0',
      'tier': 'Bronze',
      'progress': 0,
      'nextLevel': 1,
    };
    final summary = VipSummary.fromJson(rawSummary);
    expect(summary.level, 0);
    expect(summary.progress, 0.0);
  });
}

