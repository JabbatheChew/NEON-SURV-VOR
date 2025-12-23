
export enum GameStatus {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  LEVEL_UP = 'LEVEL_UP',
  PAUSED_MANUAL = 'PAUSED_MANUAL',
  GAME_OVER = 'GAME_OVER',
  STUDIO = 'STUDIO'
}

export type MapType = 'forest' | 'desert' | 'lava';

export interface MapConfig {
  id: MapType;
  name: string;
  bgColor: string;
  gridColor: string;
  accentColor: string;
  floorPattern: string;
  description: string;
  icon: string;
  enemyPool: EnemyType[];
}

export interface PlayerStats {
  hp: number;
  maxHp: number;
  mana: number;       
  maxMana: number;    
  speed: number;
  damage: number;
  fireRate: number; 
  bulletSpeed: number;
  penetration: number;
  projectileCount: number; 
  level: number;
  xp: number;
  xpToNextLevel: number;
  killCount: number;
  survivalTime: number;
  
  characterId: string;
  color: string;
  weapons: string[]; 
  customSkinUrl?: string;
  selectedMap: MapType;
  
  hasAura: boolean;
  auraRadius: number;
  auraDamage: number;
  
  hasOrbitals: boolean;
  orbitalCount: number;
  orbitalSpeed: number;
  orbitalDamage: number;
}

export interface FloatingText {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  vx: number;
  vy: number;
}

export interface Position {
  x: number;
  y: number;
}

export interface Entity extends Position {
  id: string;
  radius: number;
}

export type EnemyType = 'skeleton' | 'orc' | 'vampire' | 'bat' | 'snake' | 'dragon' | 'scorpion' | 'imp';

export interface Enemy extends Entity {
  type: EnemyType;
  hp: number;
  maxHp: number;
  speed: number;
  color: string;
  damage: number;
  xpValue: number;
  hitFlash?: number;
  knockbackX?: number;
  knockbackY?: number;
}

export interface Bullet extends Entity {
  vx: number;
  vy: number;
  damage: number;
  penetration: number;
  life: number;
  color: string;
  angle: number;
  style: string;
  spawnFrame?: number;
}

export type GemType = 'xp' | 'health' | 'magnet' | 'bomb';

export interface Gem extends Entity {
  type: GemType;
  value: number;
  color: string;
  vx: number;
  vy: number;
  isBeingMagnetized?: boolean;
}

export interface UpgradeOption {
  id: string;
  title: string;
  description: string;
  type: 'damage' | 'speed' | 'fireRate' | 'bulletSpeed' | 'penetration' | 'heal' | 'multishot' | 'weapon' | 'aura' | 'orbital';
  value: number | string;
  icon: string;
  rarity: 'common' | 'rare' | 'legendary';
}

export interface Character {
  id: string;
  name: string;
  description: string;
  unlockCondition: string;
  isUnlocked: (data: any) => boolean;
  baseStats: Partial<PlayerStats>;
  color: string;
  icon: string;
  specialName: string;         
  specialDescription: string;  
}
