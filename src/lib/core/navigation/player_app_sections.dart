enum PlayerAppSection {
  home,
  promo,
  invite,
  support,
  profile,
}

class PlayerAppSectionRoute {
  static const routes = <PlayerAppSection, String>{
    PlayerAppSection.home: '/home',
    PlayerAppSection.promo: '/promotions',
    PlayerAppSection.invite: '/referral',
    PlayerAppSection.support: '/support',
    PlayerAppSection.profile: '/profile',
  };
}
