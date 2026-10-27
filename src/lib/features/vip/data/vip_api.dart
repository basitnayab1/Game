import 'package:dio/dio.dart';
import '../../../core/networking/player_api_client.dart';

int? _toInt(dynamic v) {
  if (v == null) return null;
  if (v is num) return v.toInt();
  if (v is String) return int.tryParse(v);
  return null;
}

double _toDouble(dynamic v) {
  if (v == null) return 0.0;
  if (v is num) return v.toDouble();
  if (v is String) return double.tryParse(v) ?? 0.0;
  return 0.0;
}

class VipLevelItem {
  final int level;
  final String name;
  final String tier;
  final int? progressTargetMinor;
  final int? dailySalaryMinor;
  final int? monthlySalaryMinor;
  final int? nextLevelBonusMinor;
  final List<dynamic> benefits;

  const VipLevelItem({
    required this.level,
    required this.name,
    required this.tier,
    this.progressTargetMinor,
    this.dailySalaryMinor,
    this.monthlySalaryMinor,
    this.nextLevelBonusMinor,
    required this.benefits,
  });

  factory VipLevelItem.fromJson(Map<String, dynamic> j) => VipLevelItem(
        level: _toInt(j['level']) ?? 0,
        name: j['name']?.toString() ?? 'VIP',
        tier: j['tier']?.toString() ?? 'Standard',
        progressTargetMinor: _toInt(j['progressTargetMinor']),
        dailySalaryMinor: _toInt(j['dailySalaryMinor']),
        monthlySalaryMinor: _toInt(j['monthlySalaryMinor']),
        nextLevelBonusMinor: _toInt(j['nextLevelBonusMinor']),
        benefits: (j['benefits'] as List?) ?? const [],
      );
}

class VipSummary {
  final int level;
  final String name;
  final String tier;
  final double progress;
  final int? nextLevel;

  const VipSummary({
    required this.level,
    required this.name,
    required this.tier,
    required this.progress,
    this.nextLevel,
  });

  factory VipSummary.fromJson(Map<String, dynamic> j) => VipSummary(
        level: _toInt(j['level']) ?? 0,
        name: j['name']?.toString() ?? 'VIP 0',
        tier: j['tier']?.toString() ?? 'Bronze',
        progress: _toDouble(j['progress']),
        nextLevel: _toInt(j['nextLevel']),
      );
}

class VipPayload {
  final VipSummary summary;
  final List<VipLevelItem> levels;

  const VipPayload({
    required this.summary,
    required this.levels,
  });
}

class VipApi {
  final PlayerApiClient client;

  const VipApi(this.client);

  Future<VipPayload> get() async {
    final r = await client.get('/vip');
    final b = Map<String, dynamic>.from(r.data as Map);
    if (b['ok'] != true) {
      throw DioException(
        requestOptions: r.requestOptions,
        response: r,
        message: 'VIP request failed',
      );
    }
    final d = Map<String, dynamic>.from(b['data'] as Map);
    return VipPayload(
      summary: VipSummary.fromJson(Map<String, dynamic>.from(d['summary'] as Map)),
      levels: (d['levels'] as List)
          .map((e) => VipLevelItem.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList(),
    );
  }
}
