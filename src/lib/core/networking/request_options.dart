import 'package:dio/dio.dart';

import 'player_api_client.dart';

Options safeReadOptions() => Options(extra: {n5SafeRetry: true});

Options financialMutationOptions({required String idempotencyKey}) => Options(
      extra: {n5FinancialMutation: true},
      headers: {'Idempotency-Key': idempotencyKey},
    );
