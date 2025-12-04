
import React, { useRef, useEffect } from 'react';
import { GameStatus, PlayerStats, Entity, Enemy, Bullet, Gem, EnemyType } from '../types';
import { COLORS, ENEMY_TYPES } from '../constants';

interface GameCanvasProps {
  status: GameStatus;
  playerStats: PlayerStats;
  audioEnabled: boolean;
  onUpdateStats: (newStats: Partial<PlayerStats>) => void;
  onLevelUp: () => void;
  onGameOver: () => void;
  setUpgradeTrigger: React.Dispatch<React.SetStateAction<number>>;
  saveTimeCallback: (time: number) => void;
}

// --- SOUND ENGINE (Synth) ---
class SoundEngine {
  ctx: AudioContext | null = null;
  bgmOsc: OscillatorNode | null = null;
  bgmGain: GainNode | null = null;

  constructor() {
    try {
      // @ts-ignore
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    } catch (e) {
      console.error("Audio not supported");
    }
  }

  playShoot() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.exponentialRampToValueAtTime(100, t + 0.1);
    
    gain.gain.setValueAtTime(0.05, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(t + 0.15);
  }

  playHit() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100, t);
    osc.frequency.linearRampToValueAtTime(50, t + 0.1);
    
    gain.gain.setValueAtTime(0.05, t);
    gain.gain.linearRampToValueAtTime(0.01, t + 0.1);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(t + 0.1);
  }

  startMusic() {
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (this.bgmOsc) return;

    this.bgmOsc = this.ctx.createOscillator();
    this.bgmGain = this.ctx.createGain();
    
    this.bgmOsc.type = 'square';
    this.bgmOsc.frequency.setValueAtTime(55, this.ctx.currentTime); // Low A
    
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 2; // 2Hz throb
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 0.02;

    lfo.connect(lfoGain);
    lfoGain.connect(this.bgmGain.gain);
    
    this.bgmGain.gain.value = 0.02;

    this.bgmOsc.connect(this.bgmGain);
    this.bgmGain.connect(this.ctx.destination);
    
    this.bgmOsc.start();
    lfo.start();
  }

  stopMusic() {
    if (this.bgmOsc) {
      try {
        this.bgmOsc.stop();
        this.bgmOsc.disconnect();
      } catch(e) {}
      this.bgmOsc = null;
    }
  }
}

const GameCanvas: React.FC<GameCanvasProps> = ({ 
  status, 
  playerStats, 
  audioEnabled,
  onUpdateStats, 
  onLevelUp, 
  onGameOver,
  setUpgradeTrigger,
  saveTimeCallback
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const soundEngine = useRef<SoundEngine | null>(null);
  
  useEffect(() => {
    if (audioEnabled && !soundEngine.current) {
      soundEngine.current = new SoundEngine();
    }
    if (status === GameStatus.PLAYING && audioEnabled) {
      soundEngine.current?.startMusic();
    } else {
      soundEngine.current?.stopMusic();
    }
  }, [status, audioEnabled]);

  const gameState = useRef({
    keys: {} as Record<string, boolean>,
    playerPos: { x: window.innerWidth / 2, y: window.innerHeight / 2 },
    playerFacingLeft: false,
    enemies: [] as Enemy[],
    bullets: [] as Bullet[],
    gems: [] as Gem[],
    lastShotTime: 0,
    spawnTimer: 0,
    spawnRate: 60, 
    frameCount: 0,
    difficultyMultiplier: 1,
    gameTime: 0,
  });

  const statsRef = useRef(playerStats);
  useEffect(() => {
    statsRef.current = playerStats;
  }, [playerStats]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);
    handleResize();

    const handleKeyDown = (e: KeyboardEvent) => {
      gameState.current.keys[e.code] = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      gameState.current.keys[e.code] = false;
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    let animationFrameId: number;

    const gameLoop = () => {
      if (status === GameStatus.PLAYING) {
        update(canvas.width, canvas.height);
        draw(ctx, canvas.width, canvas.height);
      } else if (status === GameStatus.LEVEL_UP || status === GameStatus.PAUSED_MANUAL) {
        draw(ctx, canvas.width, canvas.height);
      }
      animationFrameId = requestAnimationFrame(gameLoop);
    };

    animationFrameId = requestAnimationFrame(gameLoop);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      cancelAnimationFrame(animationFrameId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, setUpgradeTrigger]);

  const update = (width: number, height: number) => {
    const state = gameState.current;
    const stats = statsRef.current;
    
    state.frameCount++;
    if (state.frameCount % 60 === 0) {
      state.gameTime++;
    }

    // --- Difficulty Scaling ---
    if (state.frameCount % 600 === 0) { 
      state.difficultyMultiplier += 0.1;
    }
    
    // Horde Mode logic
    const isHorde = (state.gameTime > 60 && state.gameTime % 60 < 10); 
    const isWarmup = state.gameTime < 20;

    let targetSpawnRate = 60 - (state.difficultyMultiplier * 5) - (stats.level * 1.5);
    if (isWarmup) targetSpawnRate = 120; // Slow start
    if (isHorde) targetSpawnRate = 5; // CRAZY FAST
    
    state.spawnRate = Math.max(5, targetSpawnRate);

    // --- Player Movement ---
    let dx = 0;
    let dy = 0;
    if (state.keys['KeyW'] || state.keys['ArrowUp']) dy -= 1;
    if (state.keys['KeyS'] || state.keys['ArrowDown']) dy += 1;
    if (state.keys['KeyA'] || state.keys['ArrowLeft']) { dx -= 1; state.playerFacingLeft = true; }
    if (state.keys['KeyD'] || state.keys['ArrowRight']) { dx += 1; state.playerFacingLeft = false; }

    if (dx !== 0 || dy !== 0) {
      const length = Math.sqrt(dx * dx + dy * dy);
      dx /= length;
      dy /= length;
      
      state.playerPos.x += dx * stats.speed;
      state.playerPos.y += dy * stats.speed;
      state.playerPos.x = Math.max(15, Math.min(width - 15, state.playerPos.x));
      state.playerPos.y = Math.max(15, Math.min(height - 15, state.playerPos.y));
    }

    // --- Enemy Spawning ---
    state.spawnTimer++;
    // Limit max enemies to prevent lag/unfairness
    const maxEnemies = isWarmup ? 10 : 200;
    
    if (state.spawnTimer >= state.spawnRate && state.enemies.length < maxEnemies) {
      state.spawnTimer = 0;
      spawnEnemy(width, height);
    }

    // --- Auto Fire ---
    if (state.frameCount - state.lastShotTime >= stats.fireRate) {
      const target = findNearestEnemy();
      if (target || stats.weaponType === 'beam') { // Beams fire anyway
         // If no target for directional weapons, shoot direction player is facing or default right
         const defaultAngle = state.playerFacingLeft ? Math.PI : 0;
         fireBullet(target, defaultAngle);
         if (audioEnabled) soundEngine.current?.playShoot();
         state.lastShotTime = state.frameCount;
      }
    }

    // --- Update Bullets ---
    for (let i = state.bullets.length - 1; i >= 0; i--) {
      const b = state.bullets[i];
      b.x += b.vx;
      b.y += b.vy;
      b.life--;
      b.angle += 0.2; 

      if (b.life <= 0 || b.x < -50 || b.x > width + 50 || b.y < -50 || b.y > height + 50) {
        state.bullets.splice(i, 1);
        continue;
      }

      for (let j = state.enemies.length - 1; j >= 0; j--) {
        const e = state.enemies[j];
        if (checkCollision(b, e)) {
          e.hp -= b.damage;
          
          // Beam doesn't reduce penetration per hit immediately or has high pen
          if (b.style !== 'beam') {
             b.penetration--;
          }

          if (audioEnabled) soundEngine.current?.playHit();

          if (e.hp <= 0) {
            state.gems.push({
              id: Math.random().toString(),
              x: e.x,
              y: e.y,
              value: e.xpValue,
              radius: 6,
              color: COLORS.gem,
              vx: 0,
              vy: 0
            });
            stats.killCount++; 
            state.enemies.splice(j, 1);
            onUpdateStats({ killCount: stats.killCount });
          }

          if (b.penetration <= 0) {
            state.bullets.splice(i, 1);
            break; 
          }
        }
      }
    }

    // --- Update Enemies ---
    for (let i = state.enemies.length - 1; i >= 0; i--) {
      const e = state.enemies[i];
      let angle = Math.atan2(state.playerPos.y - e.y, state.playerPos.x - e.x);
      
      if (e.type === 'bat') {
        e.wobbleOffset = (e.wobbleOffset || 0) + 0.1;
        angle += Math.sin(e.wobbleOffset) * 0.5;
      }

      e.x += Math.cos(angle) * e.speed;
      e.y += Math.sin(angle) * e.speed;

      const dist = Math.hypot(e.x - state.playerPos.x, e.y - state.playerPos.y);
      if (dist < e.radius + 15) { 
        stats.hp -= e.damage;
        state.enemies.splice(i, 1);
        onUpdateStats({ hp: stats.hp });
        if (audioEnabled) soundEngine.current?.playHit();
        if (stats.hp <= 0) {
             saveTimeCallback(state.gameTime); // Save the run duration
        }
      }
    }

    // --- Update Gems ---
    for (let i = state.gems.length - 1; i >= 0; i--) {
      const g = state.gems[i];
      const dist = Math.hypot(g.x - state.playerPos.x, g.y - state.playerPos.y);
      
      if (dist < 150) {
        const angle = Math.atan2(state.playerPos.y - g.y, state.playerPos.x - g.x);
        const speed = 12 + (150 - dist) / 5;
        g.x += Math.cos(angle) * speed;
        g.y += Math.sin(angle) * speed;
      }

      if (dist < 20) {
        stats.xp += g.value;
        state.gems.splice(i, 1);
        if (stats.xp >= stats.xpToNextLevel) {
          onLevelUp();
        } else {
           onUpdateStats({ xp: stats.xp });
        }
      }
    }
  };

  const spawnEnemy = (width: number, height: number) => {
    const state = gameState.current;
    const stats = statsRef.current;
    
    const levelFactor = 1 + (stats.level * 0.1); 
    const globalMultiplier = state.difficultyMultiplier * levelFactor;

    const rand = Math.random();
    let type: EnemyType = 'mouse';
    
    // Enemy progression timeline
    if (state.gameTime > 120 && rand > 0.95) type = 'ghost';
    else if (state.gameTime > 60 && rand > 0.8) type = 'bat';
    else if (state.gameTime > 30 && rand > 0.85) type = 'bear';
    else if (state.gameTime > 10 && rand > 0.9) type = 'bat';

    const baseStats = ENEMY_TYPES[type];

    const side = Math.floor(Math.random() * 4);
    let x = 0, y = 0;
    const padding = 50;
    switch(side) {
      case 0: x = Math.random() * width; y = -padding; break;
      case 1: x = width + padding; y = Math.random() * height; break;
      case 2: x = Math.random() * width; y = height + padding; break;
      case 3: x = -padding; y = Math.random() * height; break;
    }

    state.enemies.push({
      id: Math.random().toString(),
      type,
      x,
      y,
      radius: baseStats.radius,
      hp: baseStats.hpBase * globalMultiplier,
      maxHp: baseStats.hpBase * globalMultiplier,
      speed: baseStats.speed * Math.min(1.5, state.difficultyMultiplier), 
      damage: baseStats.damage * Math.sqrt(globalMultiplier), 
      xpValue: baseStats.xp * Math.sqrt(levelFactor),
      color: baseStats.color,
      wobbleOffset: Math.random() * Math.PI * 2
    });
  };

  const findNearestEnemy = (): Enemy | null => {
    const state = gameState.current;
    let nearest: Enemy | null = null;
    let minDist = Infinity;
    for (const e of state.enemies) {
      const dist = Math.hypot(e.x - state.playerPos.x, e.y - state.playerPos.y);
      if (dist < minDist) {
        minDist = dist;
        nearest = e;
      }
    }
    return nearest;
  };

  const fireBullet = (target: Enemy | null, defaultAngle: number) => {
    const state = gameState.current;
    const stats = statsRef.current;
    
    let baseAngle = defaultAngle;
    if (target) {
      baseAngle = Math.atan2(target.y - state.playerPos.y, target.x - state.playerPos.x);
    } else if (stats.weaponType === 'beam') {
      // Beam auto targets random if no close enemy, or nearest?
      // If no enemy found, don't fire beam unless we want it to just shoot random
      if (!target) return; 
    }

    const count = stats.projectileCount;
    const spreadArc = Math.min(Math.PI / 2, count * 0.2); 
    
    for (let i = 0; i < count; i++) {
      let angle = baseAngle;
      if (count > 1) {
        const startAngle = baseAngle - (spreadArc / 2);
        const step = spreadArc / (count - 1);
        angle = startAngle + (i * step);
      }

      state.bullets.push({
        id: Math.random().toString(),
        x: state.playerPos.x,
        y: state.playerPos.y,
        radius: stats.weaponType === 'orb' ? 8 : 12, 
        vx: Math.cos(angle) * stats.bulletSpeed * (stats.weaponType === 'orb' ? 1.5 : 1),
        vy: Math.sin(angle) * stats.bulletSpeed * (stats.weaponType === 'orb' ? 1.5 : 1),
        damage: stats.damage,
        penetration: stats.weaponType === 'beam' ? 999 : stats.penetration,
        life: stats.weaponType === 'beam' ? 20 : 120, 
        color: COLORS.bullet,
        angle: angle,
        style: stats.weaponType
      });
    }
  };

  const checkCollision = (c1: Entity, c2: Entity) => {
    const dx = c1.x - c2.x;
    const dy = c1.y - c2.y;
    return (dx * dx + dy * dy) < (c1.radius + c2.radius) ** 2; 
  };

  // --- DRAWING FUNCTIONS ---

  const drawCat = (ctx: CanvasRenderingContext2D, x: number, y: number, facingLeft: boolean) => {
    ctx.save();
    ctx.translate(x, y);
    if (facingLeft) ctx.scale(-1, 1);

    // Body
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fill();
    
    // Neon Aura (Using player color)
    const color = statsRef.current.color; // Use player color
    ctx.shadowBlur = 15;
    ctx.shadowColor = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Ears
    ctx.fillStyle = '#000';
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(-10, -10);
    ctx.lineTo(-14, -22);
    ctx.lineTo(-4, -14);
    ctx.fill();
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(10, -10);
    ctx.lineTo(14, -22);
    ctx.lineTo(4, -14);
    ctx.fill();
    ctx.stroke();

    // Eyes
    ctx.fillStyle = color === '#00f3ff' ? '#ff00aa' : '#fff'; 
    ctx.shadowBlur = 5;
    ctx.shadowColor = ctx.fillStyle;
    ctx.beginPath();
    ctx.ellipse(-6, -2, 3, 5, 0, 0, Math.PI * 2);
    ctx.ellipse(6, -2, 3, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Whiskers
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(2, 4); ctx.lineTo(16, 4);
    ctx.moveTo(2, 6); ctx.lineTo(16, 8);
    ctx.moveTo(-2, 4); ctx.lineTo(-16, 4);
    ctx.moveTo(-2, 6); ctx.lineTo(-16, 8);
    ctx.stroke();

    ctx.restore();
  };

  const drawEnemy = (ctx: CanvasRenderingContext2D, e: Enemy) => {
    ctx.save();
    ctx.translate(e.x, e.y);

    switch(e.type) {
      case 'ghost':
        ctx.globalAlpha = 0.6 + Math.sin(Date.now() / 200) * 0.2; 
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.arc(0, -5, 15, Math.PI, 0); 
        ctx.lineTo(15, 15);
        ctx.lineTo(5, 10);
        ctx.lineTo(-5, 15);
        ctx.lineTo(-15, 10);
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(-5, -5, 3, 0, Math.PI*2);
        ctx.arc(5, -5, 3, 0, Math.PI*2);
        ctx.fill();
        break;
      case 'bat':
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.moveTo(0, 5);
        ctx.quadraticCurveTo(15, -10, 20, 0);
        ctx.quadraticCurveTo(10, 5, 0, 5);
        ctx.quadraticCurveTo(-10, 5, -20, 0);
        ctx.quadraticCurveTo(-15, -10, 0, 5);
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, Math.PI*2);
        ctx.fill();
        break;
      case 'bear':
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.arc(-15, -15, 8, 0, Math.PI*2);
        ctx.arc(15, -15, 8, 0, Math.PI*2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, 0, 24, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = '#5c2e0e';
        ctx.beginPath();
        ctx.ellipse(0, 5, 10, 8, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = '#f00';
        ctx.beginPath();
        ctx.arc(-8, -5, 3, 0, Math.PI*2);
        ctx.arc(8, -5, 3, 0, Math.PI*2);
        ctx.fill();
        break;
      default:
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, 12, 16, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(-10, -10, 6, 0, Math.PI*2);
        ctx.arc(10, -10, 6, 0, Math.PI*2);
        ctx.fill();
        ctx.strokeStyle = 'pink';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, 12);
        ctx.quadraticCurveTo(10, 20, 5, 25);
        ctx.stroke();
        break;
    }

    ctx.restore();

    if (e.hp < e.maxHp) {
      const barW = e.radius * 2;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(e.x - barW/2, e.y - e.radius - 8, barW, 4);
      ctx.fillStyle = '#f00';
      ctx.fillRect(e.x - barW/2, e.y - e.radius - 8, barW * (e.hp/e.maxHp), 4);
    }
  };

  const drawBullet = (ctx: CanvasRenderingContext2D, b: Bullet) => {
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.angle); 

    ctx.shadowBlur = 10;
    ctx.shadowColor = b.color;
    ctx.fillStyle = b.color;
    ctx.strokeStyle = b.color;

    if (b.style === 'orb') {
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI*2);
      ctx.fill();
      // Trail effect could go here
    } else if (b.style === 'beam') {
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-10, 0);
      ctx.lineTo(20, 0);
      ctx.stroke();
    } else {
      // Claw (default)
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, 10, -Math.PI/3, Math.PI/3);
      ctx.stroke();
    }

    ctx.restore();
  };

  const draw = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const state = gameState.current;
    
    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for(let x=0; x<width; x+=60) { ctx.moveTo(x,0); ctx.lineTo(x,height); }
    for(let y=0; y<height; y+=60) { ctx.moveTo(0,y); ctx.lineTo(width,y); }
    ctx.stroke();

    for (const g of state.gems) {
      ctx.shadowBlur = 8;
      ctx.shadowColor = g.color;
      ctx.fillStyle = g.color;
      ctx.beginPath();
      ctx.arc(g.x, g.y, g.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    for (const b of state.bullets) {
      drawBullet(ctx, b);
    }

    for (const e of state.enemies) {
      drawEnemy(ctx, e);
    }

    drawCat(ctx, state.playerPos.x, state.playerPos.y, state.playerFacingLeft);

    if (state.gameTime > 60 && state.gameTime % 60 < 5) {
      ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
      ctx.fillRect(0, 0, width, height);
      ctx.font = 'bold 40px Arial';
      ctx.fillStyle = 'red';
      ctx.textAlign = 'center';
      ctx.fillText('⚠️ SÜRÜ GELİYOR ⚠️', width/2, 100);
    }
  };

  return <canvas ref={canvasRef} className="block w-full h-full" />;
};

export default GameCanvas;
