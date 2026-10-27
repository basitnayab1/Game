import 'dart:math';

/// Client-side request key for operations that the backend treats as
/// idempotent. The backend remains authoritative and must persist/enforce it.
String createIdempotencyKey(String operation) {
  final safeOperation = operation.trim().replaceAll(RegExp(r'[^A-Za-z0-9_-]'), '_');
  final timestamp = DateTime.now().microsecondsSinceEpoch;
  final random = Random().nextInt(1 << 32).toRadixString(16);
  return 'n5-$safeOperation-$timestamp-$random';
}
