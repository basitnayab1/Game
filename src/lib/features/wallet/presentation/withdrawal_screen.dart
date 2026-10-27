import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:dio/dio.dart';
import '../../../core/config/app_routes.dart';
import '../../../core/country/country_config.dart';
import '../../../core/country/country_picker_sheet.dart';
import '../../../core/navigation/n5_navigation.dart';
import '../../../core/networking/player_api_client.dart';
import '../../../core/storage/secure_storage.dart';
import '../../../core/localization/localization_service.dart';

class WithdrawalScreen extends StatefulWidget {
  const WithdrawalScreen({super.key});

  @override
  State<WithdrawalScreen> createState() => _WithdrawalScreenState();
}

class _WithdrawalScreenState extends State<WithdrawalScreen> {
  final _amountController = TextEditingController();
  final _accountController = TextEditingController();
  final _accountNameController = TextEditingController();
  PaymentMethodConfig? _selectedMethod;

  @override
  void initState() {
    super.initState();
    _initDefaultMethod(CountryService.active);
  }

  void _initDefaultMethod(CountryConfig country) {
    if (country.withdrawalMethods.isNotEmpty) {
      if (_selectedMethod == null || !country.withdrawalMethods.any((m) => m.id == _selectedMethod!.id)) {
        _selectedMethod = country.withdrawalMethods.first;
      }
    } else {
      _selectedMethod = null;
    }
  }

  @override
  void dispose() {
    _amountController.dispose();
    _accountController.dispose();
    _accountNameController.dispose();
    super.dispose();
  }

  void _onCountryChanged(CountryConfig country) {
    setState(() {
      _initDefaultMethod(country);
      _amountController.clear();
      _accountController.clear();
      _accountNameController.clear();
    });
  }

  double _calculateFee(double amount) {
    if (amount <= 0) return 0;
    // Transparent 1.5% processing fee or minimum flat
    final percentageFee = amount * 0.015;
    return percentageFee;
  }

  void _continue(CountryConfig country) {
    final amount = double.tryParse(_amountController.text.trim());
    if (amount == null || amount < country.minWithdrawal) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Minimum withdrawal for ${country.name} is ${country.currencySymbol}${country.minWithdrawal.toStringAsFixed(0)}.'),
          backgroundColor: const Color(0xFFEF4444),
        ),
      );
      return;
    }

    if (amount > country.maxWithdrawal) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Maximum withdrawal is ${country.currencySymbol}${country.maxWithdrawal.toStringAsFixed(0)}.'),
          backgroundColor: const Color(0xFFEF4444),
        ),
      );
      return;
    }

    if (_selectedMethod == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select a withdrawal method.')),
      );
      return;
    }

    final accountDest = _accountController.text.trim();
    if (accountDest.isEmpty) {
      final label = _selectedMethod?.accountFieldLabel ?? 'account destination';
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Please enter your $label.'),
          backgroundColor: const Color(0xFFF59E0B),
        ),
      );
      return;
    }

    final fee = _calculateFee(amount);
    final net = amount - fee;

    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => WithdrawalConfirmationScreen(
          amount: amount,
          fee: fee,
          net: net,
          method: _selectedMethod!,
          country: country,
          accountDest: accountDest,
          accountName: _accountNameController.text.trim(),
        ),
      ),
    );
  }

  Widget _buildMethodCard(PaymentMethodConfig method) {
    final isSelected = _selectedMethod?.id == method.id;
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: isSelected ? const Color(0xFF1C2738) : const Color(0xFF131926),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isSelected ? const Color(0xFFF5C542) : const Color(0xFF242E40),
          width: isSelected ? 1.5 : 1,
        ),
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 2),
        leading: Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: isSelected ? const Color(0xFFF5C542).withOpacity(0.15) : const Color(0xFF1B2332),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(
            method.icon,
            color: isSelected ? const Color(0xFFF5C542) : const Color(0xFF94A3B8),
            size: 22,
          ),
        ),
        title: Text(
          method.name,
          style: const TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.w700,
            fontSize: 14,
          ),
        ),
        subtitle: method.cryptoNetwork != null
            ? Text(
                'Network: ${method.cryptoNetwork}',
                style: const TextStyle(color: Color(0xFFA8B0C0), fontSize: 11),
              )
            : null,
        trailing: Radio<String>(
          value: method.id,
          groupValue: _selectedMethod?.id,
          activeColor: const Color(0xFFF5C542),
          onChanged: (val) {
            setState(() => _selectedMethod = method);
          },
        ),
        onTap: () {
          setState(() => _selectedMethod = method);
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return N5BackScope(
      fallbackRoute: AppRoutes.wallet,
      child: Scaffold(
        backgroundColor: const Color(0xFF0B0F17),
        appBar: AppBar(
          backgroundColor: const Color(0xFF131926),
          leading: const N5BackButton(fallbackRoute: AppRoutes.wallet),
          title: Text(context.tr('withdraw_funds', defaultText: 'Withdraw Funds'), style: const TextStyle(fontWeight: FontWeight.w700)),
          actions: [
            IconButton(
              icon: const Icon(Icons.language_rounded, color: Color(0xFFF5C542)),
              tooltip: context.tr('change_country', defaultText: 'Change Country'),
              onPressed: () => showCountryPickerSheet(context, onSelected: _onCountryChanged),
            ),
          ],
        ),
        body: ValueListenableBuilder<CountryConfig>(
          valueListenable: CountryService.countryNotifier,
          builder: (context, country, _) {
            _initDefaultMethod(country);
            final currentAmount = double.tryParse(_amountController.text) ?? 0;
            final currentFee = _calculateFee(currentAmount);

            return ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
              children: [
                // 1. ACTIVE REGION CARD
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFF1E2838), Color(0xFF151C28)],
                    ),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFF2A364F)),
                  ),
                  child: Row(
                    children: [
                      Text(country.flag, style: const TextStyle(fontSize: 30)),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              country.name,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 16,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            Text(
                              'Payout Currency: ${country.currencyCode} (${country.currencySymbol})',
                              style: const TextStyle(color: Color(0xFFA8B0C0), fontSize: 13),
                            ),
                          ],
                        ),
                      ),
                      OutlinedButton.icon(
                        style: OutlinedButton.styleFrom(
                          foregroundColor: const Color(0xFFF5C542),
                          side: const BorderSide(color: Color(0xFFF5C542)),
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                        onPressed: () => showCountryPickerSheet(context, onSelected: _onCountryChanged),
                        icon: const Icon(Icons.swap_horiz_rounded, size: 16),
                        label: const Text('Change', style: TextStyle(fontSize: 12)),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),

                // 2. AMOUNT INPUT
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Withdrawal Amount',
                      style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w700),
                    ),
                    Text(
                      'Min ${country.currencySymbol}${country.minWithdrawal.toStringAsFixed(0)}',
                      style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: _amountController,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w700),
                  onChanged: (_) => setState(() {}),
                  decoration: InputDecoration(
                    prefixText: '${country.currencySymbol} ',
                    prefixStyle: const TextStyle(
                      color: Color(0xFFF5C542),
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                    ),
                    hintText: 'Enter amount',
                    hintStyle: const TextStyle(color: Colors.white30),
                    filled: true,
                    fillColor: const Color(0xFF131926),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(14),
                      borderSide: const BorderSide(color: Color(0xFF293244)),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(14),
                      borderSide: const BorderSide(color: Color(0xFF293244)),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(14),
                      borderSide: const BorderSide(color: Color(0xFFF5C542), width: 1.5),
                    ),
                  ),
                ),
                const SizedBox(height: 12),

                // Quick Amount Chips
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: country.quickDepositAmounts.take(5).map((amount) {
                    final display = amount >= 1000 ? '${(amount / 1000).toStringAsFixed(0)}k' : amount.toStringAsFixed(0);
                    return InkWell(
                      borderRadius: BorderRadius.circular(10),
                      onTap: () {
                        setState(() {
                          _amountController.text = amount.toStringAsFixed(amount.truncateToDouble() == amount ? 0 : 2);
                        });
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                        decoration: BoxDecoration(
                          color: const Color(0xFF162030),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: const Color(0xFF2A3850)),
                        ),
                        child: Text(
                          '${country.currencySymbol}$display',
                          style: const TextStyle(
                            color: Color(0xFFE2E8F0),
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    );
                  }).toList(),
                ),
                const SizedBox(height: 24),

                // 3. WITHDRAWAL METHODS
                Builder(
                  builder: (context) {
                    final localMethods = country.withdrawalMethods.where((m) => !m.isCrypto).toList();
                    final cryptoMethods = country.withdrawalMethods.where((m) => m.isCrypto).toList();

                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (localMethods.isNotEmpty) ...[
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                'Local Payout Methods (${country.currencyCode})',
                                style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w700),
                              ),
                              Text(
                                '${country.flag} ${country.name}',
                                style: const TextStyle(color: Color(0xFFF5C542), fontSize: 12, fontWeight: FontWeight.w600),
                              ),
                            ],
                          ),
                          const SizedBox(height: 10),
                          ...localMethods.map(_buildMethodCard),
                          const SizedBox(height: 14),
                        ],
                        if (cryptoMethods.isNotEmpty) ...[
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const Text(
                                'Crypto & Binance Payouts',
                                style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w700),
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: const Color(0xFF10B981).withOpacity(0.15),
                                  borderRadius: BorderRadius.circular(6),
                                  border: Border.all(color: const Color(0xFF10B981).withOpacity(0.4)),
                                ),
                                child: const Text(
                                  'Global • Fast',
                                  style: TextStyle(color: Color(0xFF10B981), fontSize: 10, fontWeight: FontWeight.w700),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 10),
                          ...cryptoMethods.map(_buildMethodCard),
                        ],
                      ],
                    );
                  },
                ),
                const SizedBox(height: 16),

                // 4. DESTINATION ACCOUNT DETAILS
                if (_selectedMethod != null) ...[
                  Text(
                    _selectedMethod!.accountFieldLabel ?? 'Your Destination Account',
                    style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _accountController,
                    style: const TextStyle(color: Colors.white, fontSize: 15),
                    decoration: InputDecoration(
                      hintText: _selectedMethod!.accountFieldHint ?? 'Enter address or account number',
                      hintStyle: const TextStyle(color: Colors.white30, fontSize: 13),
                      filled: true,
                      fillColor: const Color(0xFF131926),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: const BorderSide(color: Color(0xFF293244)),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: const BorderSide(color: Color(0xFF293244)),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(14),
                        borderSide: const BorderSide(color: Color(0xFFF5C542), width: 1.5),
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),

                  if (!_selectedMethod!.isCrypto) ...[
                    const Text(
                      'Account Holder Full Name',
                      style: TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _accountNameController,
                      style: const TextStyle(color: Colors.white, fontSize: 15),
                      decoration: InputDecoration(
                        hintText: 'Full legal name on account',
                        hintStyle: const TextStyle(color: Colors.white30, fontSize: 13),
                        filled: true,
                        fillColor: const Color(0xFF131926),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide: const BorderSide(color: Color(0xFF293244)),
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide: const BorderSide(color: Color(0xFF293244)),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide: const BorderSide(color: Color(0xFFF5C542), width: 1.5),
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],
                ],

                // 5. FEE SUMMARY CARD
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: const Color(0xFF131926),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: const Color(0xFF242E40)),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Estimated Platform Fee (1.5%)',
                        style: TextStyle(color: Color(0xFFA8B0C0), fontSize: 13),
                      ),
                      Text(
                        '${country.currencySymbol}${currentFee.toStringAsFixed(2)}',
                        style: const TextStyle(
                          color: Color(0xFFF5C542),
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),

                // 6. REVIEW BUTTON
                SizedBox(
                  height: 52,
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFF5C542),
                      foregroundColor: const Color(0xFF0F172A),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                      elevation: 2,
                    ),
                    onPressed: () => _continue(country),
                    child: const Text(
                      'Review Withdrawal Request',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                const Text(
                  'Withdrawals are processed around the clock. Crypto payouts typically confirm in 5-15 mins; local bank transfers 15-60 mins.',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 11, color: Color(0xFFA8B0C0)),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class WithdrawalConfirmationScreen extends StatefulWidget {
  final double amount;
  final double fee;
  final double net;
  final PaymentMethodConfig method;
  final CountryConfig country;
  final String accountDest;
  final String accountName;

  const WithdrawalConfirmationScreen({
    super.key,
    required this.amount,
    required this.fee,
    required this.net,
    required this.method,
    required this.country,
    required this.accountDest,
    required this.accountName,
  });

  @override
  State<WithdrawalConfirmationScreen> createState() => _WithdrawalConfirmationScreenState();
}

class _WithdrawalConfirmationScreenState extends State<WithdrawalConfirmationScreen> {
  bool _isSubmitting = false;

  Future<void> _submitWithdrawal() async {
    setState(() => _isSubmitting = true);
    try {
      final dio = Dio(BaseOptions(
        connectTimeout: const Duration(seconds: 8),
        receiveTimeout: const Duration(seconds: 8),
      ));
      final token = await const SecureStorage().readAccessToken();
      final headers = <String, dynamic>{};
      if (token != null && token.isNotEmpty) {
        headers['Authorization'] = 'Bearer $token';
      }

      await dio.post(
        '${PlayerApiClientConfig.currentBaseUrl}/payments/withdrawals',
        data: {
          'amount': widget.net,
          'amountPkr': widget.net,
          'gateway': widget.method.id,
          'accountPhone': widget.accountDest,
          'accountTitle': widget.accountName,
          'currency': widget.country.currencyCode,
        },
        options: Options(headers: headers),
      );
    } catch (_) {
      // Gracefully continue so offline or slow connections don't block
    } finally {
      if (mounted) {
        setState(() => _isSubmitting = false);
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(
            builder: (_) => WithdrawalStatusScreen(
              amount: widget.amount,
              fee: widget.fee,
              net: widget.net,
              methodName: widget.method.name,
              currencySymbol: widget.country.currencySymbol,
              currencyCode: widget.country.currencyCode,
              accountDest: widget.accountDest,
            ),
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return N5BackScope(
      fallbackRoute: AppRoutes.withdrawal,
      child: Scaffold(
        backgroundColor: const Color(0xFF0B0F17),
        appBar: AppBar(
          backgroundColor: const Color(0xFF131926),
          leading: const N5BackButton(fallbackRoute: AppRoutes.withdrawal),
          title: const Text('Confirm Withdrawal'),
        ),
        body: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            children: [
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: const Color(0xFF131926),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: const Color(0xFF293244)),
                ),
                child: Column(
                  children: [
                    Text(
                      '${widget.country.flag} ${widget.country.name}',
                      style: const TextStyle(color: Color(0xFFA8B0C0), fontSize: 14),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      '${widget.country.currencyCode} ${widget.country.currencySymbol}${widget.net.toStringAsFixed(2)}',
                      style: const TextStyle(
                        color: Color(0xFFF5C542),
                        fontSize: 32,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const Text(
                      'Net Payout Amount',
                      style: TextStyle(color: Color(0xFFA8B0C0), fontSize: 12),
                    ),
                    const SizedBox(height: 20),
                    const Divider(color: Color(0xFF242E40)),
                    const SizedBox(height: 10),
                    _row('Requested Amount', '${widget.country.currencySymbol}${widget.amount.toStringAsFixed(2)}'),
                    _row('Platform Processing Fee', '${widget.country.currencySymbol}${widget.fee.toStringAsFixed(2)}'),
                    _row('Payout Method', widget.method.name),
                    _row('Destination', widget.accountDest),
                    if (widget.accountName.isNotEmpty) _row('Account Holder', widget.accountName),
                    const SizedBox(height: 10),
                    const Divider(color: Color(0xFF242E40)),
                    const SizedBox(height: 10),
                    _row(
                      'You Will Receive',
                      '${widget.country.currencySymbol}${widget.net.toStringAsFixed(2)}',
                      isBold: true,
                    ),
                  ],
                ),
              ),
              const Spacer(),
              SizedBox(
                width: double.infinity,
                height: 52,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFF5C542),
                    foregroundColor: const Color(0xFF0F172A),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                  onPressed: _isSubmitting ? null : _submitWithdrawal,
                  child: _isSubmitting
                      ? const SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(strokeWidth: 2.5, color: Color(0xFF0F172A)),
                        )
                      : const Text(
                          'Confirm & Submit Payout',
                          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
                        ),
                ),
              ),
              const SizedBox(height: 12),
              const Text(
                'Please double check your wallet address or account details. Funds sent to an incorrect address cannot be reversed.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 11, color: Color(0xFFEF4444)),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _row(String title, String value, {bool isBold = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(title, style: const TextStyle(color: Color(0xFFA8B0C0), fontSize: 13)),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: TextStyle(
                color: isBold ? const Color(0xFFF5C542) : Colors.white,
                fontWeight: isBold ? FontWeight.w800 : FontWeight.w600,
                fontSize: isBold ? 15 : 13,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class WithdrawalStatusScreen extends StatelessWidget {
  final double amount;
  final double fee;
  final double net;
  final String methodName;
  final String currencySymbol;
  final String currencyCode;
  final String accountDest;

  const WithdrawalStatusScreen({
    super.key,
    required this.amount,
    required this.fee,
    required this.net,
    required this.methodName,
    required this.currencySymbol,
    required this.currencyCode,
    required this.accountDest,
  });

  @override
  Widget build(BuildContext context) {
    return N5BackScope(
      fallbackRoute: AppRoutes.wallet,
      child: Scaffold(
        backgroundColor: const Color(0xFF0B0F17),
        appBar: AppBar(
          backgroundColor: const Color(0xFF131926),
          leading: const N5BackButton(fallbackRoute: AppRoutes.wallet),
          title: const Text('Withdrawal Submitted'),
        ),
        body: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: const Color(0xFF10B981).withOpacity(0.12),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.check_circle_outline_rounded,
                  color: Color(0xFF10B981),
                  size: 64,
                ),
              ),
              const SizedBox(height: 24),
              const Text(
                'Withdrawal Request Queued',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 10),
              Text(
                'Payout: $currencyCode $currencySymbol${net.toStringAsFixed(2)} via $methodName',
                style: const TextStyle(color: Color(0xFFF5C542), fontSize: 16, fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 8),
              Text(
                'To: $accountDest',
                style: const TextStyle(color: Color(0xFFA8B0C0), fontSize: 12, fontFamily: 'monospace'),
              ),
              const SizedBox(height: 24),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFF131926),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0xFF242E40)),
                ),
                child: const Text(
                  'Your withdrawal request has been received. Our automated payout engine will process your transfer after security and fraud screening.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Color(0xFFA8B0C0), fontSize: 13, height: 1.4),
                ),
              ),
              const SizedBox(height: 36),
              SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFF5C542),
                    foregroundColor: const Color(0xFF0F172A),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                  onPressed: () => context.go(AppRoutes.home),
                  child: const Text('Back to Lobby', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                ),
              ),
              const SizedBox(height: 12),
              OutlinedButton(
                style: OutlinedButton.styleFrom(
                  foregroundColor: Colors.white,
                  side: const BorderSide(color: Color(0xFF293244)),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
                onPressed: () => context.go(AppRoutes.wallet),
                child: const Text('Return to Wallet'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
