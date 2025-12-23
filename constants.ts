
import { UpgradeOption, EnemyType, Character, PlayerStats, MapType, MapConfig } from './types';

export const MAP_WIDTH = 4000;
export const MAP_HEIGHT = 4000;

export const MAP_CONFIGS: Record<MapType, MapConfig> = {
  forest: {
    id: 'forest',
    name: 'Cyber Forest',
    bgColor: '#041504',
    gridColor: '#0a250a',
    accentColor: '#4ade80',
    floorPattern: 'grass',
    description: 'Neon yapraklar ve pürüzsüz enerji.',
    icon: '🌳',
    enemyPool: ['bat', 'snake', 'orc', 'dragon']
  },
  desert: {
    id: 'desert',
    name: 'Neon Desert',
    bgColor: '#1a140a',
    gridColor: '#2b2010',
    accentColor: '#fbbf24',
    floorPattern: 'sand',
    description: 'Sonsuz kumlar ve kavurucu sıcak.',
    icon: '🏜️',
    enemyPool: ['skeleton', 'scorpion', 'snake', 'dragon']
  },
  lava: {
    id: 'lava',
    name: 'Techno Lava',
    bgColor: '#150505',
    gridColor: '#2a0808',
    accentColor: '#f87171',
    floorPattern: 'obsidian',
    description: 'Erimiş devreler ve volkanik küller.',
    icon: '🌋',
    enemyPool: ['vampire', 'imp', 'orc', 'dragon']
  }
};

export const INITIAL_PLAYER_STATS: PlayerStats = {
  hp: 100,
  maxHp: 100,
  mana: 0,
  maxMana: 100,
  speed: 4.8, 
  damage: 25, 
  fireRate: 45, 
  bulletSpeed: 10,
  penetration: 1,
  projectileCount: 1, 
  level: 1,
  xp: 0,
  xpToNextLevel: 100,
  killCount: 0,
  survivalTime: 0,
  characterId: 'default',
  color: '#00f3ff',
  weapons: ['claw'], 
  selectedMap: 'forest',
  hasAura: false,
  auraRadius: 100,
  auraDamage: 0.5, 
  hasOrbitals: false,
  orbitalCount: 0,
  orbitalSpeed: 0.05,
  orbitalDamage: 10,
};

export const COLORS = {
  background: '#050508', 
  player: '#00f3ff', 
  bullet: '#00ffff', 
  gem: '#00ff66', 
  health: '#ff0033', 
  mana: '#00ccff', 
  text: '#ffffff',
  magnet: '#00aaff',
  bomb: '#ffaa00'
};

export const PICKUP_CHANCES = {
  bomb: 0.008,
  magnet: 0.012, 
  health: 0.025
};

export const ENEMY_TYPES: Record<EnemyType, { color: string, radius: number, hpBase: number, damage: number, speed: number, xp: number }> = {
  skeleton: { color: '#f8fafc', radius: 16, hpBase: 25, damage: 5, speed: 2.2, xp: 12 }, 
  orc: { color: '#166534', radius: 26, hpBase: 120, damage: 15, speed: 1.4, xp: 45 },    
  vampire: { color: '#b91c1c', radius: 19, hpBase: 55, damage: 12, speed: 3.5, xp: 30 }, 
  bat: { color: '#6d28d9', radius: 11, hpBase: 12, damage: 4, speed: 4.8, xp: 8 },
  snake: { color: '#22c55e', radius: 14, hpBase: 45, damage: 10, speed: 3.0, xp: 25 },
  dragon: { color: '#f59e0b', radius: 45, hpBase: 800, damage: 25, speed: 1.8, xp: 250 },
  scorpion: { color: '#fcd34d', radius: 15, hpBase: 35, damage: 8, speed: 4.2, xp: 18 },
  imp: { color: '#ef4444', radius: 12, hpBase: 18, damage: 6, speed: 5.0, xp: 10 }
};

export const CHARACTERS: Character[] = [
  {
    id: 'default',
    name: 'Cyber Cat',
    description: 'Hızlı ve dengeli bir başlangıç.',
    unlockCondition: 'Varsayılan',
    isUnlocked: () => true,
    baseStats: { weapons: ['claw'], speed: 5.2 },
    color: '#00f3ff', 
    icon: '🐱',
    specialName: 'NEON WAVE',
    specialDescription: 'Geniş alanda şok dalgası.'
  },
  {
    id: 'ranger',
    name: 'Phantom',
    description: 'Uzun menzilli lazer uzmanı.',
    unlockCondition: 'Keskin',
    isUnlocked: () => true,
    baseStats: { weapons: ['beam'], damage: 25, bulletSpeed: 14 },
    color: '#fbbf24', 
    icon: '🏹',
    specialName: 'STORM OF LIGHT',
    specialDescription: 'Tüm mermiler 5 sn delici olur.'
  },
  {
    id: 'witch',
    name: 'Eldritch',
    description: 'Büyü küreleri ile savunma.',
    unlockCondition: 'Mistik',
    isUnlocked: () => true,
    baseStats: { weapons: ['orb'], maxMana: 150 },
    color: '#a855f7', 
    icon: '🔮',
    specialName: 'VOID REACH',
    specialDescription: 'Tüm düşmanları kendine çeker ve patlatır.'
  },
  {
    id: 'heavy',
    name: 'Vanguard',
    description: 'Dönen baltalar ve yüksek can.',
    unlockCondition: 'Dayanıklı',
    isUnlocked: () => true,
    baseStats: { hp: 250, maxHp: 250, weapons: ['axe'], speed: 3.8 },
    color: '#f43f5e', 
    icon: '🛡️',
    specialName: 'TITAN WALL',
    specialDescription: 'Gecici süre hasar almaz.'
  }
];

export const UPGRADE_POOL: UpgradeOption[] = [
  { id: 'dmg_1', title: 'Güç Çekirdeği', description: 'Hasar %20 artar.', type: 'damage', value: 0.2, icon: '💥', rarity: 'common' },
  { id: 'spd_1', title: 'Hız Modülü', description: 'Hız %15 artar.', type: 'speed', value: 0.15, icon: '🏃', rarity: 'common' },
  { id: 'wpn_axe', title: 'Siber Balta', description: 'Dönen bir balta ekle.', type: 'weapon', value: 'axe', icon: '🪓', rarity: 'rare' },
  { id: 'wpn_beam', title: 'Foton Işını', description: 'Delici bir lazer ekle.', type: 'weapon', value: 'beam', icon: '🔦', rarity: 'legendary' },
  { id: 'wpn_orb', title: 'Plazma Küresi', description: 'Enerji küresi ekle.', type: 'weapon', value: 'orb', icon: '🔮', rarity: 'rare' },
  { id: 'multi_1', title: 'Mermi Çoğaltıcı', description: 'Mermi sayısı +1.', type: 'multishot', value: 1, icon: '🔱', rarity: 'rare' },
  { id: 'heal_1', title: 'Tamir Kiti', description: '40 Can doldur.', type: 'heal', value: 40, icon: '🔧', rarity: 'common' },
];
