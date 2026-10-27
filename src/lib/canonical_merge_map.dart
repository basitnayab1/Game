/// N5 canonical merge map.
///
/// This file records ownership of major player-app domains so the final merge
/// has one source of truth and does not keep duplicate implementations.
class N5CanonicalMergeMap {
  static const apiPrefix = '/api/v1';

  static const supportedLocales = <String>[
    'en',
    'tr',
    'hi',
    'ur',
    'ar',
  ];

  static const domains = <String, String>{
    'auth': 'features/auth',
    'home': 'features/home',
    'wallet': 'features/wallet',
    'games': 'features/games',
    'rewards': 'features/rewards',
    'vip': 'features/vip',
    'referral': 'features/referral',
    'agent': 'features/agent',
    'kyc': 'features/kyc',
    'security': 'features/security',
    'notifications': 'features/notifications',
    'support': 'features/support',
    'localization': 'features/localization',
    'responsibleGaming': 'features/responsible_gaming',
    'accountClosure': 'features/account_closure',
    'profile': 'features/profile',
  };

  const N5CanonicalMergeMap();
}
