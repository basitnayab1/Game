import 'package:dio/dio.dart';
import '../../../core/networking/player_api_client.dart';

/// The player's wallet as reported by the server (amounts in paisa).
class WalletBalance {
  final int availableMinor;
  final int lockedMinor;
  final int bonusMinor;
  final String currency;

  const WalletBalance({
    required this.availableMinor,
    required this.lockedMinor,
    required this.bonusMinor,
    required this.currency,
  });

  factory WalletBalance.fromJson(Map<String, dynamic> j) => WalletBalance(
        availableMinor: (j['availableMinor'] as num? ?? 0).toInt(),
        lockedMinor: (j['lockedMinor'] as num? ?? 0).toInt(),
        bonusMinor: (j['bonusMinor'] as num? ?? 0).toInt(),
        currency: (j['currency'] ?? 'PKR') as String,
      );
}

/// Formats an amount in minor units (paisa) as "1,234.50".
String formatMinor(int minor) {
  final negative = minor < 0;
  final abs = minor.abs();
  final whole = (abs ~/ 100).toString();
  final fraction = (abs % 100).toString().padLeft(2, '0');
  final grouped = whole.replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (_) => ',');
  return '${negative ? '-' : ''}$grouped.$fraction';
}

class WalletApi {
  final PlayerApiClient client;
  const WalletApi(this.client);

  Future<WalletBalance> balance() async {
    final r = await client.get('/wallet');
    final b = Map<String, dynamic>.from(r.data as Map);
    if (b['ok'] != true) {
      throw DioException(requestOptions: r.requestOptions, response: r, message: 'Wallet request failed');
    }
    return WalletBalance.fromJson(Map<String, dynamic>.from(b['data'] as Map));
  }
}
