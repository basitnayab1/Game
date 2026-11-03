import 'dart:math' as math;

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../core/config/app_routes.dart';
import '../../../core/navigation/n5_navigation.dart';
import '../../../core/networking/player_api_client.dart';

/// The free Daily Lucky Wheel: one spin every 24 hours, prize credited by the server.
class DailyRewardsScreen extends StatefulWidget {
  const DailyRewardsScreen({super.key});

  @override
  State<DailyRewardsScreen> createState() => _DailyRewardsScreenState();
}

class _DailyRewardsScreenState extends State<DailyRewardsScreen> with SingleTickerProviderStateMixin {
  static const _colors = [Color(0xFFF5C542), Color(0xFF1F8A52), Color(0xFFFF5A5F)];

  final _client = PlayerApiClient(PlayerApiClientConfig.fromEnvironment());
  late final AnimationController _spin = AnimationController(vsync: this, duration: const Duration(seconds: 4));
  Animation<double> _angle = const AlwaysStoppedAnimation(0);

  List<String> _prizes = const [];
  bool _loading = true;
  bool _canSpin = false;
  bool _depositRequired = false;
  bool _spinning = false;
  int _remainingSeconds = 0;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadStatus();
  }

  @override
  void dispose() {
    _spin.dispose();
    super.dispose();
  }

  Future<void> _loadStatus() async {
    try {
      final r = await _client.get('/rewards/wheel');
      final d = Map<String, dynamic>.from((r.data as Map)['data'] as Map);
      setState(() {
        _prizes = List<String>.from(d['prizes'] as List);
        _canSpin = d['canSpin'] == true;
        _depositRequired = d['depositRequired'] == true;
        _remainingSeconds = (d['remainingSeconds'] as num? ?? 0).toInt();
        _error = null;
      });
    } catch (_) {
      setState(() => _error = 'Could not load the wheel.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _doSpin() async {
    if (!_canSpin || _spinning || _prizes.isEmpty) return;
    setState(() => _spinning = true);
    try {
      final r = await _client.post('/rewards/wheel/spin', data: const {});
      final d = Map<String, dynamic>.from((r.data as Map)['data'] as Map);
      final slice = (d['sliceIndex'] as num).toInt();

      // Spin a few turns and stop with the winning slice under the pointer at the top.
      final sweep = 2 * math.pi / _prizes.length;
      final target = 6 * 2 * math.pi + (2 * math.pi - (slice + 0.5) * sweep);
      _angle = Tween<double>(begin: 0, end: target).animate(CurvedAnimation(parent: _spin, curve: Curves.easeOutCubic));
      _spin.reset();
      await _spin.forward();
      if (!mounted) return;

      setState(() {
        _canSpin = false;
        _remainingSeconds = 24 * 3600;
      });
      await showDialog(
        context: context,
        builder: (_) => AlertDialog(
          title: const Text('You won!'),
          content: Text('${d['label']} has been added to your wallet.'),
          actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('OK'))],
        ),
      );
    } on DioException catch (e) {
      final body = e.response?.data;
      final err = body is Map ? body['error'] : null;
      final message = err is Map ? '${err['message'] ?? err['code']}' : 'Spin failed. Try again.';
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
      await _loadStatus();
    } finally {
      if (mounted) setState(() => _spinning = false);
    }
  }

  String get _waitText {
    final h = _remainingSeconds ~/ 3600;
    final m = (_remainingSeconds % 3600) ~/ 60;
    return 'Next free spin in ${h}h ${m}m';
  }

  @override
  Widget build(BuildContext context) {
    return N5BackScope(
      fallbackRoute: AppRoutes.home,
      child: Scaffold(
        appBar: AppBar(
          leading: const N5BackButton(fallbackRoute: AppRoutes.home),
          title: const Text('Daily Lucky Wheel'),
        ),
        body: _loading
            ? const Center(child: CircularProgressIndicator())
            : _error != null
                ? Center(child: TextButton(onPressed: _loadStatus, child: Text('$_error Retry')))
                : ListView(
                    padding: const EdgeInsets.all(20),
                    children: [
                      const Text(
                        'One free spin every 24 hours for depositing players. Your prize goes straight to your wallet.',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: Colors.grey),
                      ),
                      const SizedBox(height: 24),
                      Center(
                        child: SizedBox(
                          width: 300,
                          height: 320,
                          child: Stack(
                            alignment: Alignment.topCenter,
                            children: [
                              Positioned(
                                top: 20,
                                child: AnimatedBuilder(
                                  animation: _spin,
                                  builder: (_, __) => Transform.rotate(
                                    angle: _angle.value,
                                    child: CustomPaint(size: const Size(280, 280), painter: _WheelPainter(_prizes, _colors)),
                                  ),
                                ),
                              ),
                              const Icon(Icons.arrow_drop_down_rounded, size: 56, color: Colors.white),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                      if (_depositRequired) ...[
                        const Text(
                          'Make your first deposit to unlock the free daily spin.',
                          textAlign: TextAlign.center,
                          style: TextStyle(fontWeight: FontWeight.w600),
                        ),
                        const SizedBox(height: 12),
                        ElevatedButton(
                          // Check again on return: the deposit may have been approved meanwhile.
                          onPressed: () => context.push(AppRoutes.deposit).then((_) => _loadStatus()),
                          style: ElevatedButton.styleFrom(minimumSize: const Size.fromHeight(52)),
                          child: const Text('DEPOSIT NOW'),
                        ),
                      ] else
                        ElevatedButton(
                          onPressed: _canSpin && !_spinning ? _doSpin : null,
                          style: ElevatedButton.styleFrom(minimumSize: const Size.fromHeight(52)),
                          child: Text(_spinning ? 'Spinning...' : (_canSpin ? 'SPIN NOW' : _waitText)),
                        ),
                    ],
                  ),
      ),
    );
  }
}

class _WheelPainter extends CustomPainter {
  final List<String> prizes;
  final List<Color> colors;
  _WheelPainter(this.prizes, this.colors);

  @override
  void paint(Canvas canvas, Size size) {
    if (prizes.isEmpty) return;
    final center = size.center(Offset.zero);
    final radius = size.width / 2;
    final sweep = 2 * math.pi / prizes.length;
    final rect = Rect.fromCircle(center: center, radius: radius);
    for (var i = 0; i < prizes.length; i++) {
      // Slice 0 starts at the top and slices run clockwise.
      final start = -math.pi / 2 + i * sweep;
      canvas.drawArc(rect, start, sweep, true, Paint()..color = colors[i % colors.length]);
      canvas.save();
      canvas.translate(center.dx, center.dy);
      canvas.rotate(start + sweep / 2);
      final tp = TextPainter(
        text: TextSpan(text: prizes[i], style: const TextStyle(color: Colors.black, fontWeight: FontWeight.w800, fontSize: 13)),
        textDirection: TextDirection.ltr,
      )..layout();
      tp.paint(canvas, Offset(radius * 0.38, -tp.height / 2));
      canvas.restore();
    }
    canvas.drawCircle(center, 18, Paint()..color = const Color(0xFF0B1510));
    canvas.drawCircle(center, radius, Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 4
      ..color = const Color(0xFFF5C542));
  }

  @override
  bool shouldRepaint(_WheelPainter old) => old.prizes != prizes;
}
