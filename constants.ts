
import { UpgradeOption, EnemyType, Character, PlayerStats } from './types';

export const CANVAS_WIDTH = window.innerWidth;
export const CANVAS_HEIGHT = window.innerHeight;
export const MAP_WIDTH = 4000;
export const MAP_HEIGHT = 4000;

export const INITIAL_PLAYER_STATS: PlayerStats = {
  hp: 100,
  maxHp: 100,
  mana: 0,
  maxMana: 100,
  speed: 4.5, // Slightly faster for big map
  damage: 15,
  fireRate: 40, 
  bulletSpeed: 9,
  penetration: 1,
  projectileCount: 1, 
  level: 1,
  xp: 0,
  xpToNextLevel: 50,
  killCount: 0,
  characterId: 'default',
  color: '#00f3ff',
  weaponType: 'claw',
  
  // Passives
  hasAura: false,
  auraRadius: 100,
  auraDamage: 0.5, // per frame
  hasOrbitals: false,
  orbitalCount: 0,
  orbitalSpeed: 0.05,
  orbitalDamage: 10,
};

export const COLORS = {
  background: '#050508', // Darker void
  player: '#00f3ff', 
  bullet: '#00ffff', // Cyan claws
  gem: '#00ff66', 
  health: '#ff0033', // Red for health potion
  mana: '#00ccff', // Blue for mana
  text: '#ffffff',
  grid: '#1a1a2e',
};

export const HEALTH_DROP_CHANCE = 0.01; // 1% chance per enemy
export const HEALTH_DROP_AMOUNT = 20;

export const ENEMY_TYPES: Record<EnemyType, { color: string, radius: number, hpBase: number, damage: number, speed: number, xp: number }> = {
  mouse: {
    color: '#a0a0a0', // Grey
    radius: 12,
    hpBase: 10,
    damage: 5,
    speed: 3.5, // Faster on big map
    xp: 5
  },
  bear: {
    color: '#8b4513', // Brown
    radius: 24,
    hpBase: 60,
    damage: 15,
    speed: 1.8,
    xp: 20
  },
  bat: {
    color: '#9d00ff', // Purple
    radius: 10,
    hpBase: 15,
    damage: 8,
    speed: 4.5,
    xp: 12
  },
  ghost: {
    color: '#ffffff', // White/Transparent
    radius: 20,
    hpBase: 150,
    damage: 25,
    speed: 1.2,
    xp: 100
  }
};

export const CHARACTERS: Character[] = [
  {
    id: 'default',
    name: 'Neon Cat',
    description: 'Dengeli başlangıç karakteri.',
    unlockCondition: 'Varsayılan',
    isUnlocked: () => true,
    baseStats: {},
    color: '#00f3ff', // Cyan
    icon: '🐱',
    specialName: 'SUPER NOVA',
    specialDescription: 'Ekrandaki tüm düşmanları anında yok eder.'
  },
  {
    id: 'blitz',
    name: 'Blitz',
    description: 'Çok hızlı ama kırılgan.',
    unlockCondition: '5. Seviyeye Ulaş',
    isUnlocked: (data) => data.maxLevel >= 5,
    baseStats: {
      speed: 6.5,
      fireRate: 30, // Faster shooting
      maxHp: 60,
      hp: 60,
    },
    color: '#ffaa00', // Orange
    icon: '⚡',
    specialName: 'TIME FREEZE',
    specialDescription: '5 saniye boyunca zamanı dondurur.'
  },
  {
    id: 'chonk',
    name: 'Chonk',
    description: 'Yavaş, çok canı var, çoklu atar.',
    unlockCondition: 'Toplam 250 Düşman Öldür',
    isUnlocked: (data) => data.totalKills >= 250,
    baseStats: {
      speed: 3.0,
      maxHp: 200,
      hp: 200,
      projectileCount: 2,
      damage: 10,
    },
    color: '#00ff00', // Green
    icon: '🐅',
    specialName: 'IRON SKIN',
    specialDescription: '8 saniye boyunca ölümsüz olur.'
  },
  {
    id: 'void',
    name: 'Void Walker',
    description: 'Yüksek hasar, delici atışlar.',
    unlockCondition: 'Tek oyunda 120sn Hayatta Kal',
    isUnlocked: (data) => data.longestRun >= 120,
    baseStats: {
      damage: 25,
      fireRate: 60, // Slow
      bulletSpeed: 12,
      penetration: 3,
      weaponType: 'beam',
      color: '#aa00ff'
    },
    color: '#aa00ff', // Purple
    icon: '🔮',
    specialName: 'BLACK HOLE',
    specialDescription: 'Düşmanları yutan bir kara delik açar.'
  }
];

// Available upgrades
export const UPGRADE_POOL: UpgradeOption[] = [
  {
    id: 'dmg_1',
    title: 'Keskin Pençeler',
    description: 'Hasarı %20 artırır.',
    type: 'damage',
    value: 0.2,
    icon: '💅',
    rarity: 'common',
  },
  {
    id: 'spd_1',
    title: 'Kedi Refleksleri',
    description: 'Hareket hızını %10 artırır.',
    type: 'speed',
    value: 0.10,
    icon: '⚡',
    rarity: 'common',
  },
  {
    id: 'rate_1',
    title: 'Öfke Nöbeti',
    description: 'Saldırı hızını %10 artırır.',
    type: 'fireRate',
    value: 0.10,
    icon: '😤',
    rarity: 'common',
  },
  {
    id: 'bspd_1',
    title: 'Hızlı Savuruş',
    description: 'Mermi hızını %25 artırır.',
    type: 'bulletSpeed',
    value: 0.25,
    icon: '🌪️',
    rarity: 'common',
  },
  {
    id: 'pen_1',
    title: 'Ruh Delen',
    description: 'Mermiler +1 düşman daha delip geçer.',
    type: 'penetration',
    value: 1,
    icon: '👻',
    rarity: 'rare',
  },
  {
    id: 'heal_1',
    title: 'Dokuz Can',
    description: 'Canını 30 puan iyileştirir.',
    type: 'heal',
    value: 30,
    icon: '❤️',
    rarity: 'common',
  },
  {
    id: 'dmg_2',
    title: 'Kadim Kedi Ruhu',
    description: 'Hasarı %50 artırır!',
    type: 'damage',
    value: 0.5,
    icon: '🦁',
    rarity: 'legendary',
  },
  {
    id: 'multi_1',
    title: 'Çift Pençe',
    description: 'Aynı anda +1 mermi daha atarsın.',
    type: 'multishot',
    value: 1,
    icon: '🔱',
    rarity: 'rare',
  },
  {
    id: 'wpn_orb',
    title: 'Enerji Küresi',
    description: 'Silahını Hızlı Enerji Küresine çevirir.',
    type: 'weapon',
    value: 'orb',
    icon: '🔵',
    rarity: 'legendary',
  },
  {
    id: 'wpn_beam',
    title: 'Lazer Işını',
    description: 'Silahını delici Lazer Işınına çevirir.',
    type: 'weapon',
    value: 'beam',
    icon: '🔦',
    rarity: 'legendary',
  },
  {
    id: 'wpn_axe',
    title: 'Savaş Baltası',
    description: 'Silahını ağır hasarlı Baltaya çevirir.',
    type: 'weapon',
    value: 'axe',
    icon: '🪓',
    rarity: 'legendary',
  },
  {
    id: 'wpn_boom',
    title: 'Bumerang',
    description: 'Düşmanları biçip geri dönen Bumerang.',
    type: 'weapon',
    value: 'boomerang',
    icon: '🪃',
    rarity: 'legendary',
  },
  {
    id: 'wpn_spiral',
    title: 'Yıldız Yağmuru',
    description: 'Dönerek açılan koruyucu yıldızlar saçar.',
    type: 'weapon',
    value: 'spiral',
    icon: '🌟',
    rarity: 'legendary',
  },
  {
    id: 'aura_1',
    title: 'Sarımsak Aurası',
    description: 'Etrafında hasar veren bir alan oluşturur.',
    type: 'aura',
    value: 1,
    icon: '🧄',
    rarity: 'rare',
  },
  {
    id: 'orbital_1',
    title: 'Koruyucu Kitap',
    description: 'Etrafında dönen koruyucu bir cisim ekler.',
    type: 'orbital',
    value: 1,
    icon: '📘',
    rarity: 'rare',
  },
];
