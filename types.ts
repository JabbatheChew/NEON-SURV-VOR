
export enum GameStatus {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  LEVEL_UP = 'LEVEL_UP',
  PAUSED_MANUAL = 'PAUSED_MANUAL',
  GAME_OVER = 'GAME_OVER',
  STUDIO = 'STUDIO'
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

export type EnemyType = 'skeleton' | 'orc' | 'vampire' | 'bat';

export interface Enemy extends Entity {
  type: EnemyType;
  hp: number;
  maxHp: number;
  speed: number;
  color: string;
  damage: number;
  xpValue: number;
  hitFlash?: number;
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
  prevX?: number;
  prevY?: number;
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
