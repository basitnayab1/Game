/// Static presentation model used only for the level-detail route.
///
/// The server remains authoritative for VIP progress, eligibility and reward
/// values. This list provides the stable 1-20 navigation structure required
/// by the detail screen; live values are loaded by VipCenterScreen.
class VipLevel {
  final int number;
  final String name;
  final String tier;
  final String reward;
  final List<String> benefits;

  const VipLevel({
    required this.number,
    required this.name,
    required this.tier,
    required this.reward,
    required this.benefits,
  });
}

const List<VipLevel> vipLevels = [
  VipLevel(number: 1, name: 'VIP 1', tier: 'Bronze I', reward: 'Configured by server', benefits: ['VIP benefits configured by server']),
  VipLevel(number: 2, name: 'VIP 2', tier: 'Bronze II', reward: 'Configured by server', benefits: ['VIP benefits configured by server']),
  VipLevel(number: 3, name: 'VIP 3', tier: 'Bronze III', reward: 'Configured by server', benefits: ['VIP benefits configured by server']),
  VipLevel(number: 4, name: 'VIP 4', tier: 'Silver I', reward: 'Configured by server', benefits: ['VIP benefits configured by server']),
  VipLevel(number: 5, name: 'VIP 5', tier: 'Silver II', reward: 'Configured by server', benefits: ['VIP benefits configured by server']),
  VipLevel(number: 6, name: 'VIP 6', tier: 'Silver III', reward: 'Configured by server', benefits: ['VIP benefits configured by server']),
  VipLevel(number: 7, name: 'VIP 7', tier: 'Gold I', reward: 'Configured by server', benefits: ['VIP benefits configured by server']),
  VipLevel(number: 8, name: 'VIP 8', tier: 'Gold II', reward: 'Configured by server', benefits: ['VIP benefits configured by server']),
  VipLevel(number: 9, name: 'VIP 9', tier: 'Gold III', reward: 'Configured by server', benefits: ['VIP benefits configured by server']),
  VipLevel(number: 10, name: 'VIP 10', tier: 'Gold IV', reward: 'Configured by server', benefits: ['VIP benefits configured by server']),
  VipLevel(number: 11, name: 'VIP 11', tier: 'Platinum I', reward: 'Configured by server', benefits: ['VIP benefits configured by server']),
  VipLevel(number: 12, name: 'VIP 12', tier: 'Platinum II', reward: 'Configured by server', benefits: ['VIP benefits configured by server']),
  VipLevel(number: 13, name: 'VIP 13', tier: 'Platinum III', reward: 'Configured by server', benefits: ['VIP benefits configured by server']),
  VipLevel(number: 14, name: 'VIP 14', tier: 'Platinum IV', reward: 'Configured by server', benefits: ['VIP benefits configured by server']),
  VipLevel(number: 15, name: 'VIP 15', tier: 'Diamond I', reward: 'Configured by server', benefits: ['VIP benefits configured by server']),
  VipLevel(number: 16, name: 'VIP 16', tier: 'Diamond II', reward: 'Configured by server', benefits: ['VIP benefits configured by server']),
  VipLevel(number: 17, name: 'VIP 17', tier: 'Diamond III', reward: 'Configured by server', benefits: ['VIP benefits configured by server']),
  VipLevel(number: 18, name: 'VIP 18', tier: 'Diamond IV', reward: 'Configured by server', benefits: ['VIP benefits configured by server']),
  VipLevel(number: 19, name: 'VIP 19', tier: 'Black', reward: 'Configured by server', benefits: ['VIP benefits configured by server']),
  VipLevel(number: 20, name: 'VIP 20', tier: 'Royal', reward: 'Configured by server', benefits: ['VIP benefits configured by server']),
];
