import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/navigation/n5_navigation.dart';
import '../../../core/networking/player_api_client.dart';
import '../data/game_catalog_api.dart';

/// Player-facing game detail/launch boundary.
///
/// Production launch obtains a fresh, authorized provider session from
/// the backend. The client never determines outcomes or credits/debits funds directly.
class GameDetailScreen extends StatefulWidget {
  final String gameName;
  final String providerName;
  final String? gameId;

  const GameDetailScreen({
    super.key,
    required this.gameName,
    required this.providerName,
    this.gameId,
  });

  @override
  State<GameDetailScreen> createState() => _GameDetailScreenState();
}

class _GameDetailScreenState extends State<GameDetailScreen> {
  bool launching = false;

  Future<void> _launch() async {
    if (launching) return;
    setState(() => launching = true);

    try {
      if (widget.gameId != null && widget.gameId!.isNotEmpty) {
        final api = GameLaunchApi(PlayerApiClient(PlayerApiClientConfig.fromEnvironment()));
        final result = await api.launchGame(widget.gameId!);
        if (!mounted) return;

        final rawUrl = result.launchUrl;
        final targetUrl = rawUrl.startsWith('http')
            ? rawUrl
            : '${PlayerApiClientConfig.currentBaseUrl}$rawUrl';

        final uri = Uri.parse(targetUrl);
        final launched = await launchUrl(uri, mode: LaunchMode.externalApplication);
        if (!launched && mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Session ready: ${result.sessionId.substring(0, 8)}... (${result.gameName})'),
            ),
          );
        }
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Game launch requires an authorized provider session from the backend.',
            ),
          ),
        );
      }
    } catch (e) {
      if (!mounted) return;
      final msg = e is DioException ? (e.message ?? 'Game launch failed') : e.toString();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(msg)),
      );
    } finally {
      if (mounted) setState(() => launching = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return N5BackScope(
      returnToLobby: true,
      child: Scaffold(
        backgroundColor: const Color(0xFF0B0F17),
        appBar: AppBar(
          leading: const N5BackButton(returnToLobby: true),
          title: Text(widget.gameName),
        ),
        body: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Container(
              height: 210,
              decoration: BoxDecoration(
                color: const Color(0xFF171E2B),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: const Color(0xFF293244)),
              ),
              child: const Center(
                child: Icon(Icons.casino_rounded, size: 82, color: Color(0xFF8B7CFF)),
              ),
            ),
            const SizedBox(height: 18),
            Text(widget.gameName, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800)),
            const SizedBox(height: 6),
            Text('Provider: ${widget.providerName}', style: const TextStyle(color: Color(0xFFA8B0C0))),
            const SizedBox(height: 18),
            const Text(
              'Before launch, the backend verifies account/session status, age and geographic eligibility, provider availability and the authorized game session.',
              style: TextStyle(color: Color(0xFFA8B0C0), fontSize: 13),
            ),
            const SizedBox(height: 20),
            SizedBox(
              height: 52,
              child: ElevatedButton.icon(
                onPressed: launching ? null : _launch,
                icon: launching
                    ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                    : const Icon(Icons.play_arrow_rounded),
                label: Text(launching ? 'Launching...' : 'Play'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
