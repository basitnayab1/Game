import 'dart:async';
import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:ota_update/ota_update.dart';
import 'package:package_info_plus/package_info_plus.dart';
import '../networking/player_api_client.dart';

/// A newer Android build published on the server.
class AppRelease {
  final int versionCode;
  final String versionName;
  final String sha256;
  final bool mandatory;
  final String notes;
  final Uri apkUri;

  const AppRelease({
    required this.versionCode,
    required this.versionName,
    required this.sha256,
    required this.mandatory,
    required this.notes,
    required this.apkUri,
  });
}

/// Checks the server for a newer APK and installs it from inside the app.
class AppUpdater {
  static bool _checkedThisSession = false;

  /// The newer release, or null when this build is current (or the check fails).
  static Future<AppRelease?> latestNewerRelease() async {
    if (kIsWeb || !Platform.isAndroid) return null;
    try {
      final info = await PackageInfo.fromPlatform();
      final current = int.tryParse(info.buildNumber) ?? 0;
      final client = PlayerApiClient(PlayerApiClientConfig.fromEnvironment());
      final r = await client.get('/app/android/latest');
      final d = Map<String, dynamic>.from((r.data as Map)['data'] as Map);
      final code = (d['versionCode'] as num).toInt();
      if (code <= current) return null;
      return AppRelease(
        versionCode: code,
        versionName: d['versionName'] as String,
        sha256: d['sha256'] as String,
        mandatory: d['mandatory'] == true,
        notes: (d['notes'] ?? '') as String,
        // The APK is served by the same host as the API, outside the /api/v1 prefix.
        apkUri: Uri.parse(PlayerApiClientConfig.currentBaseUrl).resolve(d['apkUrl'] as String),
      );
    } catch (_) {
      return null;
    }
  }

  /// Offers the update once per app session (call from the first screen after sign-in).
  static Future<void> checkOnStart(BuildContext context) async {
    if (_checkedThisSession) return;
    _checkedThisSession = true;
    final release = await latestNewerRelease();
    if (release != null && context.mounted) await offer(context, release);
  }

  /// Checks now and tells the player the result (for a "Check for updates" button).
  static Future<void> checkManually(BuildContext context) async {
    final messenger = ScaffoldMessenger.of(context);
    final release = await latestNewerRelease();
    if (!context.mounted) return;
    if (release == null) {
      messenger.showSnackBar(const SnackBar(content: Text('You have the latest version.')));
    } else {
      await offer(context, release);
    }
  }

  static Future<void> offer(BuildContext context, AppRelease release) {
    return showDialog<void>(
      context: context,
      barrierDismissible: !release.mandatory,
      builder: (_) => PopScope(
        canPop: !release.mandatory,
        child: _UpdateDialog(release: release),
      ),
    );
  }
}

class _UpdateDialog extends StatefulWidget {
  final AppRelease release;
  const _UpdateDialog({required this.release});

  @override
  State<_UpdateDialog> createState() => _UpdateDialogState();
}

class _UpdateDialogState extends State<_UpdateDialog> {
  StreamSubscription<OtaEvent>? _sub;
  double? _progress;
  bool _working = false;
  String? _error;

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }

  void _start() {
    setState(() {
      _working = true;
      _error = null;
      _progress = 0;
    });
    try {
      _sub = OtaUpdate()
          .execute(
            widget.release.apkUri.toString(),
            destinationFilename: 'N5-Game-${widget.release.versionCode}.apk',
            // The download is refused unless it matches the published hash.
            sha256checksum: widget.release.sha256,
          )
          .listen(_onEvent, onError: (_) => _fail('Download failed. Check your internet and try again.'));
    } catch (_) {
      _fail('Update could not start.');
    }
  }

  void _onEvent(OtaEvent event) {
    switch (event.status) {
      case OtaStatus.DOWNLOADING:
        setState(() => _progress = (double.tryParse(event.value ?? '') ?? 0) / 100);
      case OtaStatus.INSTALLING:
        // Android's installer takes over; the app restarts on the new version.
        setState(() => _progress = 1);
      case OtaStatus.PERMISSION_NOT_GRANTED_ERROR:
        _fail('Allow "Install unknown apps" for N5 Game in Settings, then tap Update again.');
      case OtaStatus.CHECKSUM_ERROR:
        _fail('The download was corrupted. Please try again.');
      case OtaStatus.CANCELED:
        _fail('Update cancelled.');
      default:
        _fail('Download failed. Check your internet and try again.');
    }
  }

  void _fail(String message) {
    if (!mounted) return;
    setState(() {
      _working = false;
      _error = message;
    });
  }

  @override
  Widget build(BuildContext context) {
    final r = widget.release;
    final installing = _progress == 1;
    return AlertDialog(
      title: Text('Update available — v${r.versionName}'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (r.notes.isNotEmpty) Text(r.notes) else const Text('A new version of N5 Game is ready.'),
          if (r.mandatory) ...[
            const SizedBox(height: 8),
            const Text('This update is required to keep playing.', style: TextStyle(fontWeight: FontWeight.w600)),
          ],
          if (_working) ...[
            const SizedBox(height: 16),
            LinearProgressIndicator(value: installing ? null : _progress),
            const SizedBox(height: 6),
            Text(installing ? 'Opening installer...' : 'Downloading ${((_progress ?? 0) * 100).round()}%'),
          ],
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(_error!, style: const TextStyle(color: Color(0xFFEF4444))),
          ],
        ],
      ),
      actions: [
        if (!r.mandatory && !_working)
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Later')),
        ElevatedButton(
          onPressed: _working ? null : _start,
          child: Text(_error == null ? 'Update' : 'Try Again'),
        ),
      ],
    );
  }
}
