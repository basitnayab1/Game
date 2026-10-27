import 'package:flutter_test/flutter_test.dart';
import 'package:dio/dio.dart';

import 'package:n5_game/core/networking/idempotency.dart';
import 'package:n5_game/core/networking/request_options.dart';
import 'package:n5_game/core/networking/player_api_client.dart';

void main() {
  test('idempotency key is non-empty and operation-scoped', () {
    final key = createIdempotencyKey('deposit/create');
    expect(key.startsWith('n5-deposit_create-'), isTrue);
  });

  test('financial mutation options disable automatic replay', () {
    final options = financialMutationOptions(idempotencyKey: 'test-key');
    expect(options.extra?[n5FinancialMutation], isTrue);
    expect(options.headers?['Idempotency-Key'], 'test-key');
    expect(options.extra?[n5SafeRetry], isNull);
  });

  test('safe read options explicitly allow one refresh retry', () {
    final options = safeReadOptions();
    expect(options.extra?[n5SafeRetry], isTrue);
    expect(options.extra?[n5FinancialMutation], isNull);
  });

  test('Dio options remain valid for request composition', () {
    final options = financialMutationOptions(idempotencyKey: 'abc');
    expect(options, isA<Options>());
  });
}
