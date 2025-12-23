
export enum GameStatus {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  LEVEL_UP = 'LEVEL_UP', // Old PAUSED
  PAUSED_MANUAL = 'PAUSED_MANUAL', // New ESC Pause
  GAME_OVER = 'GAME_OVER'
}

export interface PlayerStats {
  hp: number;
  maxHp: number;
  mana: number;       
  maxMana: number;    
  speed: number;
  damage: number;
  fireRate: number; // Frames between shots
  bulletSpeed: number;
  penetration: number;
  projectileCount: number; // Number of bullets per shot
  level: number;
  xp: number;
  xpToNextLevel: number;
  killCount: number;
  
  // Character specific visuals/mechanics
  characterId: string;
  color: string;
  weaponType: 'claw' | 'orb' | 'beam' | 'axe' | 'boomerang' | 'spiral'; // Added types
  
  // Passives
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
  wobbleOffset?: number; // For bat movement
}

export interface Bullet extends Entity {
  vx: number;
  vy: number;
  damage: number;
  penetration: number;
  life: number; // Frames to live
  color: string;
  angle: number; // For drawing rotation
  style: 'claw' | 'orb' | 'beam' | 'axe' | 'boomerang' | 'spiral';
  gravity?: number; // For axe physics
  
  // New physics props
  initialVx?: number; 
  initialVy?: number;
  spawnFrame?: number; // For time-based pathing (spiral)
}

export interface Gem extends Entity {
  type: 'xp' | 'health'; // Distinguish between XP and HP drops
  value: number;
  color: string;
  vx: number;
  vy: number;
}

export interface UpgradeOption {
  id: string;
  title: string;
  description: string;
  type: 'damage' | 'speed' | 'fireRate' | 'bulletSpeed' | 'penetration' | 'heal' | 'multishot' | 'weapon' | 'aura' | 'orbital';
  value: number | string; // value can be string for weapon type change
  icon: string;
  rarity: 'common' | 'rare' | 'legendary';
}

export interface GameSettings {
  audioEnabled: boolean;
}

export interface PersistentData {
  totalKills: number;
  maxLevel: number;
  longestRun: number; // seconds
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
