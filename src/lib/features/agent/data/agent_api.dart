import '../../../core/networking/player_api_client.dart';
class AgentApi { final PlayerApiClient client; AgentApi(this.client);
 Future<Map<String,dynamic>> get() async { final r=await client.get('/agent'); return Map<String,dynamic>.from(r.data as Map); }
 Future<Map<String,dynamic>> apply({String? note}) async { final r=await client.post('/agent/apply', data:{if(note!=null) 'note':note}); return Map<String,dynamic>.from(r.data as Map); }
}
