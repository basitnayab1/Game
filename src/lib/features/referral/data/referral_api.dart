import '../../../core/networking/player_api_client.dart';
class ReferralApi { final PlayerApiClient client; ReferralApi(this.client);
 Future<Map<String,dynamic>> get() async { final r=await client.get('/referral'); return Map<String,dynamic>.from(r.data as Map); }
 Future<List<dynamic>> history() async { final r=await client.get('/referral/history'); final m=Map<String,dynamic>.from(r.data as Map); return List<dynamic>.from((m['data'] as List?) ?? const []); }
}
