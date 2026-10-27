import 'package:flutter/material.dart';

enum PaymentCategory { wallet, bank, upi, card, crypto }

class PaymentMethodConfig {
  final String id;
  final String name;
  final PaymentCategory category;
  final IconData icon;
  final String badgeText;
  final String? accountFieldLabel;
  final String? accountFieldHint;
  final bool isCrypto;
  final String? cryptoNetwork;
  final String? defaultDepositAddress;
  final String? instructions;

  const PaymentMethodConfig({
    required this.id,
    required this.name,
    required this.category,
    required this.icon,
    this.badgeText = '',
    this.accountFieldLabel,
    this.accountFieldHint,
    this.isCrypto = false,
    this.cryptoNetwork,
    this.defaultDepositAddress,
    this.instructions,
  });

  factory PaymentMethodConfig.fromJson(Map<String, dynamic> json) {
    final catStr = (json['category'] as String? ?? 'wallet').toLowerCase();
    PaymentCategory cat = PaymentCategory.wallet;
    if (catStr == 'crypto') {
      cat = PaymentCategory.crypto;
    } else if (catStr == 'bank') {
      cat = PaymentCategory.bank;
    } else if (catStr == 'upi') {
      cat = PaymentCategory.upi;
    }

    final isCrypto = cat == PaymentCategory.crypto;
    IconData icon = Icons.account_balance_wallet;
    if (isCrypto) {
      icon = Icons.currency_bitcoin;
    } else if (cat == PaymentCategory.bank) {
      icon = Icons.account_balance;
    } else if (cat == PaymentCategory.upi) {
      icon = Icons.qr_code_2;
    }

    return PaymentMethodConfig(
      id: json['id']?.toString() ?? json['name']?.toString() ?? 'custom',
      name: json['name']?.toString() ?? 'Payment Method',
      category: cat,
      icon: icon,
      badgeText: json['badge_text']?.toString() ?? (isCrypto ? 'Crypto' : 'Instant'),
      isCrypto: isCrypto,
      defaultDepositAddress: json['account_number']?.toString(),
      accountFieldLabel: isCrypto
          ? 'Your Wallet Address / TxHash'
          : (cat == PaymentCategory.upi ? 'Your UPI ID / UTR' : 'Your Sender Number & TID'),
      accountFieldHint: json['account_title']?.toString(),
      instructions: json['instructions']?.toString(),
    );
  }
}

class CountryConfig {
  final String id;
  final String name;
  final String flag;
  final String dialCode;
  final String currencyCode;
  final String currencySymbol;
  final String phoneHint;
  final double minDeposit;
  final double maxDeposit;
  final double minWithdrawal;
  final double maxWithdrawal;
  final List<double> quickDepositAmounts;
  final List<PaymentMethodConfig> depositMethods;
  final List<PaymentMethodConfig> withdrawalMethods;

  const CountryConfig({
    required this.id,
    required this.name,
    required this.flag,
    required this.dialCode,
    required this.currencyCode,
    required this.currencySymbol,
    required this.phoneHint,
    required this.minDeposit,
    required this.maxDeposit,
    required this.minWithdrawal,
    required this.maxWithdrawal,
    required this.quickDepositAmounts,
    required this.depositMethods,
    required this.withdrawalMethods,
  });

  // --- CRYPTO & BINANCE DEPOSIT METHODS (Available in ALL countries) ---
  static const _binancePay = PaymentMethodConfig(
    id: 'binance_pay',
    name: 'Binance Pay',
    category: PaymentCategory.crypto,
    icon: Icons.currency_bitcoin,
    badgeText: 'Instant • 0 Fee',
    isCrypto: true,
    accountFieldLabel: 'Binance Pay ID / Email',
    accountFieldHint: 'Enter your 9-digit Binance Pay ID',
    defaultDepositAddress: 'N5GAME-PAY-ID: 882910432',
    instructions: 'Send USDT via Binance Pay to Pay ID 882910432. Enter your Binance Pay ID / Order ID below.',
  );

  static const _usdtTrc20 = PaymentMethodConfig(
    id: 'usdt_trc20',
    name: 'USDT (TRC-20)',
    category: PaymentCategory.crypto,
    icon: Icons.token,
    badgeText: 'Fast & Secure',
    isCrypto: true,
    cryptoNetwork: 'TRC-20 (TRON)',
    accountFieldLabel: 'TRC-20 Wallet Address / TXID',
    accountFieldHint: 'T...',
    defaultDepositAddress: 'TYDzsYbmkgjp8G67mGj8k2s1N5GameTrc20Addr',
    instructions: 'Send USDT to this TRON (TRC-20) address only. Enter the TXID / Hash after sending.',
  );

  static const _usdtBep20 = PaymentMethodConfig(
    id: 'usdt_bep20',
    name: 'USDT (BEP-20 / BSC)',
    category: PaymentCategory.crypto,
    icon: Icons.token,
    badgeText: 'Low Fee',
    isCrypto: true,
    cryptoNetwork: 'BEP-20 (BNB Smart Chain)',
    accountFieldLabel: 'BEP-20 Wallet Address / TXID',
    accountFieldHint: '0x...',
    defaultDepositAddress: '0x8829104321A85dFb682e0C63519b7829104321A8',
    instructions: 'Send USDT via BNB Smart Chain (BEP-20). Enter the Transaction Hash below.',
  );

  static const _btc = PaymentMethodConfig(
    id: 'crypto_btc',
    name: 'Bitcoin (BTC)',
    category: PaymentCategory.crypto,
    icon: Icons.currency_bitcoin,
    badgeText: 'Crypto',
    isCrypto: true,
    cryptoNetwork: 'Bitcoin',
    accountFieldLabel: 'BTC Address / TXID',
    accountFieldHint: '1... or bc1...',
    defaultDepositAddress: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
    instructions: 'Send BTC to this Bitcoin address. Minimum 0.0005 BTC.',
  );

  static const List<PaymentMethodConfig> cryptoDepositMethods = [
    _binancePay,
    _usdtTrc20,
    _usdtBep20,
    _btc,
  ];

  // --- CRYPTO & BINANCE WITHDRAWAL METHODS (Available in ALL countries) ---
  static const _binancePayWithdrawal = PaymentMethodConfig(
    id: 'binance_pay_withdraw',
    name: 'Binance Pay',
    category: PaymentCategory.crypto,
    icon: Icons.currency_bitcoin,
    badgeText: 'Instant • 0 Fee',
    isCrypto: true,
    accountFieldLabel: 'Your Binance Pay ID / Email',
    accountFieldHint: '9-digit Binance Pay ID',
  );

  static const _usdtTrc20Withdrawal = PaymentMethodConfig(
    id: 'usdt_trc20_withdraw',
    name: 'USDT (TRC-20 Tron)',
    category: PaymentCategory.crypto,
    icon: Icons.token,
    badgeText: 'Fast Payout',
    isCrypto: true,
    cryptoNetwork: 'TRC-20 (TRON)',
    accountFieldLabel: 'Your TRC-20 Wallet Address',
    accountFieldHint: 'Starts with T (e.g. TYDz...)',
  );

  static const _usdtBep20Withdrawal = PaymentMethodConfig(
    id: 'usdt_bep20_withdraw',
    name: 'USDT (BEP-20 BSC)',
    category: PaymentCategory.crypto,
    icon: Icons.token,
    badgeText: 'Low Fee',
    isCrypto: true,
    cryptoNetwork: 'BEP-20 (BNB Smart Chain)',
    accountFieldLabel: 'Your BEP-20 Wallet Address',
    accountFieldHint: 'Starts with 0x...',
  );

  static const _btcWithdrawal = PaymentMethodConfig(
    id: 'btc_withdraw',
    name: 'Bitcoin (BTC)',
    category: PaymentCategory.crypto,
    icon: Icons.currency_bitcoin,
    badgeText: 'Blockchain',
    isCrypto: true,
    cryptoNetwork: 'Bitcoin',
    accountFieldLabel: 'Your BTC Wallet Address',
    accountFieldHint: '1... / 3... / bc1...',
  );

  static const List<PaymentMethodConfig> cryptoWithdrawalMethods = [
    _binancePayWithdrawal,
    _usdtTrc20Withdrawal,
    _usdtBep20Withdrawal,
    _btcWithdrawal,
  ];

  // --- COUNTRIES LIST (Real Countries Only) ---
  static const List<CountryConfig> allCountries = [
    // 1. USA 🇺🇸
    CountryConfig(
      id: 'US',
      name: 'United States',
      flag: '🇺🇸',
      dialCode: '+1',
      currencyCode: 'USD',
      currencySymbol: r'$',
      phoneHint: '202 555 0199',
      minDeposit: 10,
      maxDeposit: 10000,
      minWithdrawal: 20,
      maxWithdrawal: 10000,
      quickDepositAmounts: [10, 25, 50, 100, 250, 500, 1000],
      depositMethods: [
        PaymentMethodConfig(
          id: 'cash_app',
          name: 'Cash App',
          category: PaymentCategory.wallet,
          icon: Icons.attach_money,
          badgeText: 'Popular in US',
          accountFieldLabel: r'Cash App $cashtag',
          accountFieldHint: r'$YourCashtag',
          instructions: r'Send payment to $N5GameOfficial on Cash App. Enter your $cashtag for verification.',
        ),
        PaymentMethodConfig(
          id: 'zelle',
          name: 'Zelle',
          category: PaymentCategory.bank,
          icon: Icons.account_balance,
          badgeText: 'Direct Bank',
          accountFieldLabel: 'Zelle Email / Phone',
          accountFieldHint: 'user@email.com or phone',
          instructions: 'Transfer via Zelle to payments@n5game.com. Enter your Zelle name & phone.',
        ),
        PaymentMethodConfig(
          id: 'us_card',
          name: 'Debit / Credit Card',
          category: PaymentCategory.card,
          icon: Icons.credit_card,
          badgeText: 'Visa / Mastercard',
          accountFieldLabel: 'Cardholder Name',
          accountFieldHint: 'John Doe',
          instructions: 'Secure card checkout via Stripe / Authorize.net gateway.',
        ),
        PaymentMethodConfig(
          id: 'apple_google_pay',
          name: 'Apple Pay / Google Pay',
          category: PaymentCategory.wallet,
          icon: Icons.phone_android,
          badgeText: 'Mobile 1-Tap',
          accountFieldLabel: 'Phone / Account',
          accountFieldHint: 'Apple/Google Wallet account',
        ),
        ...cryptoDepositMethods,
      ],
      withdrawalMethods: [
        PaymentMethodConfig(
          id: 'cash_app',
          name: 'Cash App',
          category: PaymentCategory.wallet,
          icon: Icons.attach_money,
          accountFieldLabel: r'Your $cashtag',
          accountFieldHint: r'$YourCashtag',
        ),
        PaymentMethodConfig(
          id: 'zelle',
          name: 'Zelle',
          category: PaymentCategory.bank,
          icon: Icons.account_balance,
          accountFieldLabel: 'Your Zelle Email / Phone',
          accountFieldHint: 'user@email.com',
        ),
        PaymentMethodConfig(
          id: 'wire_transfer',
          name: 'Bank Wire / ACH',
          category: PaymentCategory.bank,
          icon: Icons.account_balance_outlined,
          accountFieldLabel: 'Routing & Account Number',
          accountFieldHint: 'Routing: XXXXX, Account: XXXXX',
        ),
        ...cryptoWithdrawalMethods,
      ],
    ),

    // 2. INDIA 🇮🇳
    CountryConfig(
      id: 'IN',
      name: 'India',
      flag: '🇮🇳',
      dialCode: '+91',
      currencyCode: 'INR',
      currencySymbol: '₹',
      phoneHint: '98765 43210',
      minDeposit: 300,
      maxDeposit: 100000,
      minWithdrawal: 500,
      maxWithdrawal: 100000,
      quickDepositAmounts: [500, 1000, 2000, 5000, 10000, 25000],
      depositMethods: [
        PaymentMethodConfig(
          id: 'upi_all',
          name: 'UPI (GPay / PhonePe / Paytm)',
          category: PaymentCategory.upi,
          icon: Icons.qr_code_2,
          badgeText: 'Instant • Most Popular',
          accountFieldLabel: 'Your UPI ID (VPA)',
          accountFieldHint: 'username@okhdfcbank / username@ybl',
          instructions: 'Pay to UPI ID: n5game@icici or scan UPI QR code. Enter your 12-digit UPI UTR number.',
        ),
        PaymentMethodConfig(
          id: 'paytm_wallet',
          name: 'Paytm Wallet',
          category: PaymentCategory.wallet,
          icon: Icons.account_balance_wallet,
          badgeText: 'Fast',
          accountFieldLabel: 'Paytm Mobile Number',
          accountFieldHint: '10-digit mobile number',
        ),
        PaymentMethodConfig(
          id: 'in_netbanking',
          name: 'IMPS / Net Banking',
          category: PaymentCategory.bank,
          icon: Icons.account_balance,
          badgeText: 'All Indian Banks',
          accountFieldLabel: 'Sender Account & Bank',
          accountFieldHint: 'Account Number & Bank Name',
        ),
        ...cryptoDepositMethods,
      ],
      withdrawalMethods: [
        PaymentMethodConfig(
          id: 'upi_payout',
          name: 'UPI Transfer',
          category: PaymentCategory.upi,
          icon: Icons.qr_code_2,
          accountFieldLabel: 'Your UPI ID',
          accountFieldHint: 'username@upi',
        ),
        PaymentMethodConfig(
          id: 'in_bank_payout',
          name: 'IMPS / Bank Transfer',
          category: PaymentCategory.bank,
          icon: Icons.account_balance,
          accountFieldLabel: 'Bank Account & IFSC Code',
          accountFieldHint: 'A/C: XXXXXXXXXX, IFSC: SBIN000XXXX',
        ),
        ...cryptoWithdrawalMethods,
      ],
    ),

    // 3. BANGLADESH 🇧🇩
    CountryConfig(
      id: 'BD',
      name: 'Bangladesh',
      flag: '🇧🇩',
      dialCode: '+880',
      currencyCode: 'BDT',
      currencySymbol: '৳',
      phoneHint: '1700 000000',
      minDeposit: 300,
      maxDeposit: 50000,
      minWithdrawal: 500,
      maxWithdrawal: 50000,
      quickDepositAmounts: [500, 1000, 2000, 5000, 10000, 25000],
      depositMethods: [
        PaymentMethodConfig(
          id: 'bkash',
          name: 'bKash',
          category: PaymentCategory.wallet,
          icon: Icons.phone_android,
          badgeText: 'Instant • Popular in BD',
          accountFieldLabel: 'bKash Mobile Number',
          accountFieldHint: '017XXXXXXXX',
          instructions: 'Send Money to bKash Personal: 01712345678. Enter your bKash TrxID below.',
        ),
        PaymentMethodConfig(
          id: 'nagad',
          name: 'Nagad',
          category: PaymentCategory.wallet,
          icon: Icons.account_balance_wallet,
          badgeText: 'Fast',
          accountFieldLabel: 'Nagad Mobile Number',
          accountFieldHint: '01XXXXXXXXX',
          instructions: 'Send Money to Nagad: 01812345678. Enter TrxID.',
        ),
        PaymentMethodConfig(
          id: 'rocket',
          name: 'Rocket',
          category: PaymentCategory.wallet,
          icon: Icons.rocket_launch,
          badgeText: 'DBBL Rocket',
          accountFieldLabel: 'Rocket 12-digit Account',
          accountFieldHint: '01XXXXXXXXXX',
        ),
        PaymentMethodConfig(
          id: 'bd_bank',
          name: 'Local Bank Transfer',
          category: PaymentCategory.bank,
          icon: Icons.account_balance,
          badgeText: 'Dutch Bangla / City Bank',
          accountFieldLabel: 'Sender Account Name',
          accountFieldHint: 'Account holder name & Bank',
        ),
        ...cryptoDepositMethods,
      ],
      withdrawalMethods: [
        PaymentMethodConfig(
          id: 'bkash_withdraw',
          name: 'bKash Withdrawal',
          category: PaymentCategory.wallet,
          icon: Icons.phone_android,
          accountFieldLabel: 'Your bKash Personal Number',
          accountFieldHint: '017XXXXXXXX',
        ),
        PaymentMethodConfig(
          id: 'nagad_withdraw',
          name: 'Nagad Withdrawal',
          category: PaymentCategory.wallet,
          icon: Icons.account_balance_wallet,
          accountFieldLabel: 'Your Nagad Number',
          accountFieldHint: '018XXXXXXXX',
        ),
        PaymentMethodConfig(
          id: 'rocket_withdraw',
          name: 'Rocket Withdrawal',
          category: PaymentCategory.wallet,
          icon: Icons.rocket_launch,
          accountFieldLabel: 'Your Rocket 12-digit Account',
          accountFieldHint: '01XXXXXXXXXX',
        ),
        ...cryptoWithdrawalMethods,
      ],
    ),

    // 4. PAKISTAN 🇵🇰
    CountryConfig(
      id: 'PK',
      name: 'Pakistan',
      flag: '🇵🇰',
      dialCode: '+92',
      currencyCode: 'PKR',
      currencySymbol: 'Rs',
      phoneHint: '300 1234567',
      minDeposit: 100,
      maxDeposit: 50000,
      minWithdrawal: 500,
      maxWithdrawal: 100000,
      quickDepositAmounts: [100, 500, 1000, 2500, 5000, 10000],
      depositMethods: [
        PaymentMethodConfig(
          id: 'easypaisa',
          name: 'Easypaisa',
          category: PaymentCategory.wallet,
          icon: Icons.phone_android,
          badgeText: 'Instant',
          accountFieldLabel: 'Easypaisa Account Number',
          accountFieldHint: '03001234567',
          instructions: 'Send payment to Easypaisa Account: 03076975507. Enter your Sender Number & TrxID.',
        ),
        PaymentMethodConfig(
          id: 'jazzcash',
          name: 'JazzCash',
          category: PaymentCategory.wallet,
          icon: Icons.account_balance_wallet,
          badgeText: 'Instant',
          accountFieldLabel: 'JazzCash Account Number',
          accountFieldHint: '03001234567',
          instructions: 'Send payment to JazzCash Account: 03076975507. Enter your Sender Number & TID.',
        ),
        PaymentMethodConfig(
          id: 'nayapay_sadapay',
          name: 'NayaPay / SadaPay',
          category: PaymentCategory.wallet,
          icon: Icons.credit_card,
          badgeText: 'Digital Bank',
          accountFieldLabel: 'NayaPay / SadaPay ID',
          accountFieldHint: '03XXXXXXXXX / @nayapay',
        ),
        PaymentMethodConfig(
          id: 'pk_bank',
          name: 'Bank Transfer (1Link)',
          category: PaymentCategory.bank,
          icon: Icons.account_balance,
          badgeText: 'All Pakistani Banks',
          accountFieldLabel: 'Sender Account / IBAN',
          accountFieldHint: 'PKXX... / Account Title',
        ),
        ...cryptoDepositMethods,
      ],
      withdrawalMethods: [
        PaymentMethodConfig(
          id: 'easypaisa_withdraw',
          name: 'Easypaisa Withdrawal',
          category: PaymentCategory.wallet,
          icon: Icons.phone_android,
          accountFieldLabel: 'Your Easypaisa Number',
          accountFieldHint: '03001234567',
        ),
        PaymentMethodConfig(
          id: 'jazzcash_withdraw',
          name: 'JazzCash Withdrawal',
          category: PaymentCategory.wallet,
          icon: Icons.account_balance_wallet,
          accountFieldLabel: 'Your JazzCash Number',
          accountFieldHint: '03001234567',
        ),
        PaymentMethodConfig(
          id: 'pk_bank_withdraw',
          name: 'Bank Transfer (IBFT)',
          category: PaymentCategory.bank,
          icon: Icons.account_balance,
          accountFieldLabel: 'Bank Name, Account & Title',
          accountFieldHint: 'Title: Ali Khan, IBAN: PK...',
        ),
        ...cryptoWithdrawalMethods,
      ],
    ),
  ];
}

/// Global State Controller for Country & Currency in N5 Game
class CountryService {
  CountryService._();

  // Default to USA or first configured country
  static CountryConfig _activeCountry = CountryConfig.allCountries[0]; // USA
  static final ValueNotifier<CountryConfig> countryNotifier = ValueNotifier<CountryConfig>(_activeCountry);

  static CountryConfig get active => _activeCountry;

  static void setCountry(CountryConfig country) {
    _activeCountry = country;
    countryNotifier.value = country;
  }

  static void setCountryById(String id) {
    final match = CountryConfig.allCountries.firstWhere(
      (c) => c.id.toUpperCase() == id.toUpperCase(),
      orElse: () => CountryConfig.allCountries[0],
    );
    setCountry(match);
  }
}
