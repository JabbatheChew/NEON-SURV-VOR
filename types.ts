
export enum GameStatus {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  LEVEL_UP = 'LEVEL_UP',
  PAUSED_MANUAL = 'PAUSED_MANUAL',
  GAME_OVER = 'GAME_OVER'
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
  customSkinUrl?: string; // AI tarafından üretilen skin için url
  
  hasAura: boolean;
  auraRadius: number;
  auraDamage: number;
  
  hasOrbitals: boolean;
  orbitalCount: number;
  orbitalSpeed: number;
  orbitalDamage: number;
}

export interface Position {
  x: number;
  y: number;
}

export interface Entity extends Position {
  id: string;
  radius: number;
}

export type EnemyType = 'mouse' | 'bear' | 'bat' | 'ghost';

export interface Enemy extends Entity {
  type: EnemyType;
  hp: number;
  maxHp: number;
  speed: number;
  color: string;
  damage: number;
  xpValue: number;
  wobbleOffset?: number;
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
  initialVx?: number; 
  initialVy?: number;
  spawnFrame?: number;
  prevX?: number;
  prevY?: number;
}

export interface Particle extends Position {
  id: string;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  radius: number;
}

export interface Gem extends Entity {
  type: 'xp' | 'health' | 'magnet' | 'bomb' | 'freeze';
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

export interface PersistentData {
  totalKills: number;
  maxLevel: number;
  longestRun: number;
}

export interface Character {
  id: string;
  name: string;
  description: string;
  unlockCondition: string;
  isUnlocked: (data: PersistentData) => boolean;
  baseStats: Partial<PlayerStats>;
  color: string;
  icon: string;
  specialName: string;         
  specialDescription: string;  
}
