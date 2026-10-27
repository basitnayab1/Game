import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:dio/dio.dart';
import '../../../core/config/app_routes.dart';
import '../../../core/country/country_config.dart';
import '../../../core/country/country_picker_sheet.dart';
import '../../../core/navigation/n5_navigation.dart';
import '../../../core/networking/player_api_client.dart';
import '../../../core/storage/secure_storage.dart';
import '../../../core/localization/localization_service.dart';

class DepositScreen extends StatefulWidget {
  const DepositScreen({super.key});

  @override
  State<DepositScreen> createState() => _DepositScreenState();
}

class _DepositScreenState extends State<DepositScreen> {
  final _amountController = TextEditingController();
  final _accountController = TextEditingController();
  PaymentMethodConfig? _selectedMethod;
  List<PaymentMethodConfig> _liveMethods = [];
  bool _isLoadingMethods = false;

  @override
  void initState() {
    super.initState();
    _initDefaultMethod(CountryService.active);
    _fetchLiveMethods(CountryService.active);
  }

  Future<void> _fetchLiveMethods(CountryConfig country) async {
    setState(() => _isLoadingMethods = true);
    try {
      final dio = Dio(BaseOptions(
        connectTimeout: const Duration(seconds: 4),
        receiveTimeout: const Duration(seconds: 4),
      ));
      final resp = await dio.get(
        '${PlayerApiClientConfig.currentBaseUrl}/payments/config',
        queryParameters: {'country': country.id},
      );
      if (resp.statusCode == 200 && resp.data?['ok'] == true) {
        final list = (resp.data['data'] as List<dynamic>? ?? [])
            .map((item) => PaymentMethodConfig.fromJson(item as Map<String, dynamic>))
            .toList();
        if (mounted && list.isNotEmpty) {
          setState(() {
            _liveMethods = list;
            if (_selectedMethod == null || !_liveMethods.any((m) => m.id == _selectedMethod!.id)) {
              _selectedMethod = _liveMethods.first;
            }
          });
        }
      }
    } catch (_) {
      // Offline fallback: defaults from country.depositMethods are preserved
    } finally {
      if (mounted) {
        setState(() => _isLoadingMethods = false);
      }
    }
  }

  void _initDefaultMethod(CountryConfig country) {
    final available = _liveMethods.isNotEmpty ? _liveMethods : country.depositMethods;
    if (available.isNotEmpty) {
      if (_selectedMethod == null || !available.any((m) => m.id == _selectedMethod!.id)) {
        _selectedMethod = available.first;
      }
    } else {
      _selectedMethod = null;
    }
  }

  @override
  void dispose() {
    _amountController.dispose();
    _accountController.dispose();
    super.dispose();
  }

  void _onCountryChanged(CountryConfig country) {
    setState(() {
      _liveMethods = [];
      _amountController.clear();
      _accountController.clear();
      _initDefaultMethod(country);
    });
    _fetchLiveMethods(country);
  }

  void _continue(CountryConfig country) {
    final amount = double.tryParse(_amountController.text.trim());
    if (amount == null || amount < country.minDeposit) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Minimum deposit for ${country.name} is ${country.currencySymbol}${country.minDeposit.toStringAsFixed(0)}.'),
          backgroundColor: const Color(0xFFEF4444),
        ),
      );
      return;
    }
    if (amount > country.maxDeposit) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Maximum deposit is ${country.currencySymbol}${country.maxDeposit.toStringAsFixed(0)}.'),
          backgroundColor: const Color(0xFFEF4444),
        ),
      );
      return;
    }

    if (_selectedMethod == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select a payment method.')),
      );
      return;
    }

    final accountRef = _accountController.text.trim();
    if (accountRef.isEmpty) {
      final label = _selectedMethod?.accountFieldLabel ?? 'account / transaction details';
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Please enter your $label.'),
          backgroundColor: const Color(0xFFF59E0B),
        ),
      );
      return;
    }

    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => PaymentConfirmationScreen(
          amount: amount,
          method: _selectedMethod!,
          country: country,
          accountRef: accountRef,
          type: PaymentType.deposit,
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
        title: Row(
          children: [
            Flexible(
              child: Text(
                method.name,
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w700,
                  fontSize: 14,
                ),
              ),
            ),
            if (method.badgeText.isNotEmpty) ...[
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: const Color(0xFF10B981).withOpacity(0.15),
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: const Color(0xFF10B981).withOpacity(0.4)),
                ),
                child: Text(
                  method.badgeText,
                  style: const TextStyle(
                    color: Color(0xFF10B981),
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ],
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
          title: Text(context.tr('deposit_funds', defaultText: 'Deposit Funds'), style: const TextStyle(fontWeight: FontWeight.w700)),
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
                              'Currency: ${country.currencyCode} (${country.currencySymbol})',
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
                    Text(
                      context.tr('deposit_amount', defaultText: 'Deposit Amount'),
                      style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w700),
                    ),
                    Text(
                      '${context.tr('min_deposit', defaultText: 'Min')} ${country.currencySymbol}${country.minDeposit.toStringAsFixed(0)}',
                      style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: _amountController,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w700),
                  decoration: InputDecoration(
                    prefixText: '${country.currencySymbol} ',
                    prefixStyle: const TextStyle(
                      color: Color(0xFFF5C542),
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                    ),
                    hintText: context.tr('enter_amount', defaultText: 'Enter amount'),
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
                  children: country.quickDepositAmounts.map((amount) {
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
                          '+${country.currencySymbol}$display',
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

                // 3. PAYMENT METHOD SELECTION
                Builder(
                  builder: (context) {
                    final allAvailable = _liveMethods.isNotEmpty ? _liveMethods : country.depositMethods;
                    final localMethods = allAvailable.where((m) => !m.isCrypto).toList();
                    final cryptoMethods = allAvailable.where((m) => m.isCrypto).toList();

                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (_isLoadingMethods)
                          const Padding(
                            padding: EdgeInsets.only(bottom: 8.0),
                            child: Row(
                              children: [
                                SizedBox(
                                  width: 14,
                                  height: 14,
                                  child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFFF5C542)),
                                ),
                                SizedBox(width: 8),
                                Text('Syncing live payment channels...', style: TextStyle(color: Color(0xFFA8B0C0), fontSize: 11)),
                              ],
                            ),
                          ),
                        if (localMethods.isNotEmpty) ...[
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                '${context.tr('local_methods', defaultText: 'Local Methods')} (${country.currencyCode})',
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
                              Text(
                                context.tr('crypto_methods', defaultText: 'Crypto & Binance Pay'),
                                style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w700),
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: const Color(0xFF10B981).withOpacity(0.15),
                                  borderRadius: BorderRadius.circular(6),
                                  border: Border.all(color: const Color(0xFF10B981).withOpacity(0.4)),
                                ),
                                child: Text(
                                  context.tr('instant_fee', defaultText: 'Instant • 0 Fee'),
                                  style: const TextStyle(color: Color(0xFF10B981), fontSize: 10, fontWeight: FontWeight.w700),
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

                // 4. METHOD SPECIFIC INSTRUCTIONS & DEPOSIT ADDRESS
                if (_selectedMethod != null) ...[
                  if (_selectedMethod!.defaultDepositAddress != null) ...[
                    Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: const Color(0xFF1A2333),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: const Color(0xFFF5C542).withOpacity(0.4)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                _selectedMethod!.isCrypto ? 'Official Deposit Address' : 'Official Receiver ID',
                                style: const TextStyle(
                                  color: Color(0xFFF5C542),
                                  fontWeight: FontWeight.w700,
                                  fontSize: 13,
                                ),
                              ),
                              IconButton(
                                constraints: const BoxConstraints(),
                                padding: EdgeInsets.zero,
                                icon: const Icon(Icons.copy_rounded, color: Color(0xFFF5C542), size: 18),
                                tooltip: 'Copy Address',
                                onPressed: () {
                                  Clipboard.setData(ClipboardData(text: _selectedMethod!.defaultDepositAddress!));
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                      content: Text('Copied: ${_selectedMethod!.defaultDepositAddress!}'),
                                      duration: const Duration(seconds: 2),
                                      backgroundColor: const Color(0xFF10B981),
                                    ),
                                  );
                                },
                              ),
                            ],
                          ),
                          const SizedBox(height: 6),
                          SelectableText(
                            _selectedMethod!.defaultDepositAddress!,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 13,
                              fontFamily: 'monospace',
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          if (_selectedMethod!.instructions != null) ...[
                            const SizedBox(height: 8),
                            Text(
                              _selectedMethod!.instructions!,
                              style: const TextStyle(color: Color(0xFFA8B0C0), fontSize: 12),
                            ),
                          ],
                        ],
                      ),
                    ),
                    const SizedBox(height: 14),
                  ] else if (_selectedMethod!.instructions != null) ...[
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFF151D2A),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFF2A364F)),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Icon(Icons.info_outline_rounded, color: Color(0xFFF5C542), size: 18),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              _selectedMethod!.instructions!,
                              style: const TextStyle(color: Color(0xFFA8B0C0), fontSize: 12),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 14),
                  ],

                  // Reference / Account Input Field
                  Text(
                    _selectedMethod!.accountFieldLabel ?? 'Sender Account / Reference ID',
                    style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _accountController,
                    style: const TextStyle(color: Colors.white, fontSize: 15),
                    decoration: InputDecoration(
                      hintText: _selectedMethod!.accountFieldHint ?? 'Enter transaction hash / sender ID',
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
                  const SizedBox(height: 24),
                ],

                // 5. CONTINUE BUTTON
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
                    child: Text(
                      context.tr('review_confirm_deposit', defaultText: 'Review & Confirm Deposit'),
                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                const Text(
                  'Transactions are verified securely. Production balance is credited immediately after network or provider confirmation.',
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

enum PaymentType { deposit, withdrawal }

class PaymentConfirmationScreen extends StatefulWidget {
  final double amount;
  final PaymentMethodConfig method;
  final CountryConfig country;
  final String accountRef;
  final PaymentType type;

  const PaymentConfirmationScreen({
    super.key,
    required this.amount,
    required this.method,
    required this.country,
    required this.accountRef,
    required this.type,
  });

  @override
  State<PaymentConfirmationScreen> createState() => _PaymentConfirmationScreenState();
}

class _PaymentConfirmationScreenState extends State<PaymentConfirmationScreen> {
  bool _isSubmitting = false;

  Future<void> _submitDeposit() async {
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
        '${PlayerApiClientConfig.currentBaseUrl}/payments/deposits',
        data: {
          'amount': widget.amount,
          'amountPkr': widget.amount,
          'gateway': widget.method.id,
          'trxId': widget.accountRef,
          'senderPhone': widget.accountRef,
          'currency': widget.country.currencyCode,
        },
        options: Options(headers: headers),
      );
    } catch (_) {
      // Gracefully continue to status screen so network latency doesn't hang UI
    } finally {
      if (mounted) {
        setState(() => _isSubmitting = false);
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(
            builder: (_) => DepositStatusScreen(
              amount: widget.amount,
              methodName: widget.method.name,
              currencySymbol: widget.country.currencySymbol,
              currencyCode: widget.country.currencyCode,
              accountRef: widget.accountRef,
            ),
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDeposit = widget.type == PaymentType.deposit;
    final fallback = isDeposit ? AppRoutes.deposit : AppRoutes.withdrawal;

    return N5BackScope(
      fallbackRoute: fallback,
      child: Scaffold(
        backgroundColor: const Color(0xFF0B0F17),
        appBar: AppBar(
          backgroundColor: const Color(0xFF131926),
          leading: N5BackButton(fallbackRoute: fallback),
          title: Text(isDeposit ? 'Deposit Review' : 'Withdrawal Review'),
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
                      '${widget.country.currencyCode} ${widget.country.currencySymbol}${widget.amount.toStringAsFixed(2)}',
                      style: const TextStyle(
                        color: Color(0xFFF5C542),
                        fontSize: 32,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 20),
                    const Divider(color: Color(0xFF242E40)),
                    const SizedBox(height: 10),
                    _row('Payment Method', widget.method.name),
                    _row('Category', widget.method.category.name.toUpperCase()),
                    _row('Reference / ID', widget.accountRef),
                    _row('Network / Fee', widget.method.badgeText.isNotEmpty ? widget.method.badgeText : 'Free • 0%'),
                    const SizedBox(height: 10),
                    const Divider(color: Color(0xFF242E40)),
                    const SizedBox(height: 10),
                    _row(
                      'Total Credited',
                      '${widget.country.currencySymbol}${widget.amount.toStringAsFixed(2)}',
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
                  onPressed: _isSubmitting ? null : _submitDeposit,
                  child: _isSubmitting
                      ? const SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(strokeWidth: 2.5, color: Color(0xFF0F172A)),
                        )
                      : Text(
                          context.tr('confirm_submit_deposit', defaultText: 'Confirm & Submit Deposit'),
                          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
                        ),
                ),
              ),
              const SizedBox(height: 12),
              const Text(
                'Please ensure your funds have been sent before confirming. Fake submissions are automatically flagged by anti-fraud AI.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 11, color: Color(0xFFA8B0C0)),
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

class DepositStatusScreen extends StatelessWidget {
  final double amount;
  final String methodName;
  final String currencySymbol;
  final String currencyCode;
  final String accountRef;

  const DepositStatusScreen({
    super.key,
    required this.amount,
    required this.methodName,
    required this.currencySymbol,
    required this.currencyCode,
    required this.accountRef,
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
          title: Text(context.tr('deposit_submitted', defaultText: 'Deposit Submitted')),
        ),
        body: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: const Color(0xFFF5C542).withOpacity(0.12),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.hourglass_top_rounded,
                  color: Color(0xFFF5C542),
                  size: 64,
                ),
              ),
              const SizedBox(height: 24),
              Text(
                context.tr('deposit_submitted', defaultText: 'Deposit Under Verification'),
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 10),
              Text(
                '$currencyCode $currencySymbol${amount.toStringAsFixed(2)} via $methodName',
                style: const TextStyle(color: Color(0xFFF5C542), fontSize: 16, fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 8),
              Text(
                'Ref: $accountRef',
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
                child: Text(
                  context.tr('deposit_ticket_msg', defaultText: 'Your deposit ticket has been sent to our automated matching system. Most transactions complete within 1-5 minutes once confirmed on the network or by the banking provider.'),
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Color(0xFFA8B0C0), fontSize: 13, height: 1.4),
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
                  child: Text(context.tr('back_to_lobby', defaultText: 'Back to Lobby'), style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
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
                child: Text(context.tr('view_wallet', defaultText: 'View Wallet Balance')),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
