import 'package:dio/dio.dart';

import '../../../core/networking/player_api_client.dart';

class AccountStatementSummary {
  final int totalDepositMinor;
  final int totalPlayMinor;
  final int totalWithdrawalMinor;
  final int totalWithdrawalFeeMinor;
  final int totalBonusReceivedMinor;
  final String currency;

  const AccountStatementSummary({
    required this.totalDepositMinor,
    required this.totalPlayMinor,
    required this.totalWithdrawalMinor,
    required this.totalWithdrawalFeeMinor,
    required this.totalBonusReceivedMinor,
    required this.currency,
  });

  factory AccountStatementSummary.fromJson(Map<String, dynamic> json) => AccountStatementSummary(
        totalDepositMinor: json['totalDepositMinor'] as int,
        totalPlayMinor: json['totalPlayMinor'] as int,
        totalWithdrawalMinor: json['totalWithdrawalMinor'] as int,
        totalWithdrawalFeeMinor: json['totalWithdrawalFeeMinor'] as int,
        totalBonusReceivedMinor: json['totalBonusReceivedMinor'] as int,
        currency: json['currency'] as String,
      );
}

class AccountStatementDeposit {
  final String id;
  final String date;
  final int amountMinor;
  final String method;
  final String status;
  const AccountStatementDeposit({required this.id, required this.date, required this.amountMinor, required this.method, required this.status});
  factory AccountStatementDeposit.fromJson(Map<String, dynamic> j) => AccountStatementDeposit(id: j['id'] as String, date: j['date'] as String, amountMinor: j['amountMinor'] as int, method: j['method'] as String, status: j['status'] as String);
}

class AccountStatementWithdrawal {
  final String id;
  final String date;
  final int amountMinor;
  final int feeMinor;
  final int netMinor;
  final String method;
  final String status;
  const AccountStatementWithdrawal({required this.id, required this.date, required this.amountMinor, required this.feeMinor, required this.netMinor, required this.method, required this.status});
  factory AccountStatementWithdrawal.fromJson(Map<String, dynamic> j) => AccountStatementWithdrawal(id: j['id'] as String, date: j['date'] as String, amountMinor: j['amountMinor'] as int, feeMinor: j['feeMinor'] as int, netMinor: j['netMinor'] as int, method: j['method'] as String, status: j['status'] as String);
}

class AccountStatementResponse {
  final AccountStatementSummary summary;
  final List<AccountStatementDeposit> deposits;
  final List<AccountStatementWithdrawal> withdrawals;
  const AccountStatementResponse({required this.summary, required this.deposits, required this.withdrawals});
  factory AccountStatementResponse.fromJson(Map<String, dynamic> j) => AccountStatementResponse(
        summary: AccountStatementSummary.fromJson(Map<String, dynamic>.from(j['summary'] as Map)),
        deposits: (j['deposits'] as List).map((e) => AccountStatementDeposit.fromJson(Map<String, dynamic>.from(e as Map))).toList(),
        withdrawals: (j['withdrawals'] as List).map((e) => AccountStatementWithdrawal.fromJson(Map<String, dynamic>.from(e as Map))).toList(),
      );
}

class AccountStatementApi {
  final PlayerApiClient client;
  const AccountStatementApi(this.client);

  Future<AccountStatementResponse> fetch({required DateTime from, required DateTime to}) async {
    if (from.isAfter(to)) throw const FormatException('Invalid date range');
    final response = await client.get('/wallet/statement', queryParameters: {
      'fromDate': _date(from),
      'toDate': _date(to),
    });
    final body = Map<String, dynamic>.from(response.data as Map);
    if (body['ok'] != true) throw DioException(requestOptions: response.requestOptions, response: response, message: body['error']?.toString() ?? 'Statement request failed');
    return AccountStatementResponse.fromJson(Map<String, dynamic>.from(body['data'] as Map));
  }

  String _date(DateTime d) => '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
}
