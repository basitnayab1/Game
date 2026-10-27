class PlayerSecurityContract {
  static const bool neverStoreProviderPinOrOtp = true;
  static const bool neverTrustClientWalletBalance = true;
  static const bool requireServerFinancialStatus = true;
  static const bool requireSecureTransport = true;
}
