class AppFeatureFlags {
  final bool showPromotions;
  final bool showVip;
  final bool showReferral;
  final bool showAgent;
  final bool showKyc;
  final bool showResponsibleGaming;
  final bool showAccountClosure;

  const AppFeatureFlags({
    this.showPromotions = true,
    this.showVip = true,
    this.showReferral = true,
    this.showAgent = true,
    this.showKyc = true,
    this.showResponsibleGaming = true,
    this.showAccountClosure = true,
  });
}
