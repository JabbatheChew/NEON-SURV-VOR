
import React, { useRef, useEffect } from 'react';
import { GameStatus, PlayerStats, Entity, Enemy, Bullet, Gem, EnemyType } from '../types';
import { COLORS, ENEMY_TYPES, HEALTH_DROP_CHANCE, HEALTH_DROP_AMOUNT, MAP_WIDTH, MAP_HEIGHT } from '../constants';

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

  playHeal() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.linearRampToValueAtTime(600, t + 0.1);
    osc.frequency.linearRampToValueAtTime(400, t + 0.2);
    
    gain.gain.setValueAtTime(0.1, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.3);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(t + 0.3);
  }

  playSpecial() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'square';
    osc.frequency.setValueAtTime(200, t);
    osc.frequency.linearRampToValueAtTime(800, t + 0.5);
    
    gain.gain.setValueAtTime(0.1, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 1.0);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(t + 1.0);
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
    playerPos: { x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 },
    camera: { x: 0, y: 0 },
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
    // Special Ability State
    specialActive: false,
    specialDuration: 0,
    specialTimer: 0,
    specialEffectRadius: 0, 
    // Passive Logic
    orbitalAngle: 0,
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
      
      // TRIGGER SPECIAL
      if (e.code === 'Space' && statsRef.current.mana >= statsRef.current.maxMana && status === GameStatus.PLAYING) {
        triggerSpecial();
      }
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

  const triggerSpecial = () => {
    const state = gameState.current;
    const stats = statsRef.current;
    
    state.specialActive = true;
    state.specialTimer = 0;
    
    // Reset Mana
    stats.mana = 0;
    onUpdateStats({ mana: 0 });

    if (audioEnabled) soundEngine.current?.playSpecial();

    // Duration based on character
    switch(stats.characterId) {
      case 'blitz': state.specialDuration = 300; break; // 5s Freeze
      case 'chonk': state.specialDuration = 480; break; // 8s Shield
      case 'void': state.specialDuration = 180; break; // 3s BlackHole
      default: state.specialDuration = 30; // Instant Nova (short visual)
    }
  };

  const update = (screenWidth: number, screenHeight: number) => {
    const state = gameState.current;
    const stats = statsRef.current;
    
    state.frameCount++;
    if (state.frameCount % 60 === 0) {
      state.gameTime++;
    }

    // --- CAMERA LOGIC ---
    // Center camera on player, but clamp to map bounds
    state.camera.x = state.playerPos.x - screenWidth / 2;
    state.camera.y = state.playerPos.y - screenHeight / 2;
    state.camera.x = Math.max(0, Math.min(MAP_WIDTH - screenWidth, state.camera.x));
    state.camera.y = Math.max(0, Math.min(MAP_HEIGHT - screenHeight, state.camera.y));

    // --- Mana Regeneration ---
    if (!state.specialActive && stats.mana < stats.maxMana && state.frameCount % 10 === 0) {
      const regenRate = 0.5; // Passive regen
      stats.mana = Math.min(stats.maxMana, stats.mana + regenRate);
      onUpdateStats({ mana: stats.mana });
    }

    // --- PASSIVE: AURA (Garlic) ---
    if (stats.hasAura && state.frameCount % 10 === 0) { // Tick every 10 frames
       state.enemies.forEach(e => {
          const dist = Math.hypot(e.x - state.playerPos.x, e.y - state.playerPos.y);
          if (dist < stats.auraRadius) {
             e.hp -= stats.auraDamage * 10; // DPS check
             if (e.hp <= 0 && e.hp + (stats.auraDamage*10) > 0) { // Just died
                // we handle death in update enemies, but to be safe let's ensure we damage enough
             }
          }
       });
    }

    // --- PASSIVE: ORBITALS ---
    if (stats.hasOrbitals) {
      state.orbitalAngle += stats.orbitalSpeed;
    }

    // --- Special Ability Logic ---
    if (state.specialActive) {
      state.specialTimer++;
      
      if (stats.characterId === 'default') { // Nova
        // Expand rapidly to cover screen (approx 1500px radius to cover corners of large screens)
        state.specialEffectRadius = (state.specialTimer / 20) * 1500; 
        
        let batchKills = 0;
        
        // Reverse loop to safely remove enemies
        for (let i = state.enemies.length - 1; i >= 0; i--) {
            const e = state.enemies[i];
            const dist = Math.hypot(e.x - state.playerPos.x, e.y - state.playerPos.y);
            
            // Kill everything inside the expanding nova
            if (dist < state.specialEffectRadius) {
                 // Instant Remove
                 state.enemies.splice(i, 1);
                 
                 // Drop loot
                 const isHealthDrop = Math.random() < HEALTH_DROP_CHANCE;
                 state.gems.push({
                   id: Math.random().toString(),
                   x: e.x,
                   y: e.y,
                   value: isHealthDrop ? HEALTH_DROP_AMOUNT : e.xpValue,
                   radius: isHealthDrop ? 8 : 6,
                   color: isHealthDrop ? COLORS.health : COLORS.gem,
                   vx: 0,
                   vy: 0,
                   type: isHealthDrop ? 'health' : 'xp'
                 });

                 batchKills++;
            }
        }

        if (batchKills > 0) {
            stats.killCount += batchKills;
            onUpdateStats({ killCount: stats.killCount });
            // Play one sound for the batch to avoid audio explosion
            if (audioEnabled) soundEngine.current?.playHit();
        }
      }
      else if (stats.characterId === 'void') { // Black Hole
        // Pull enemies to center
        state.enemies.forEach(e => {
          const angle = Math.atan2(state.playerPos.y - e.y, state.playerPos.x - e.x);
          e.x += Math.cos(angle) * 8;
          e.y += Math.sin(angle) * 8;
          // Damage near center
          const dist = Math.hypot(e.x - state.playerPos.x, e.y - state.playerPos.y);
          if (dist < 50) e.hp -= 5;
        });
      }

      if (state.specialTimer >= state.specialDuration) {
        state.specialActive = false;
        state.specialEffectRadius = 0;
      }
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
      
      const speedMult = (state.specialActive && stats.characterId === 'blitz') ? 2 : 1;
      
      state.playerPos.x += dx * stats.speed * speedMult;
      state.playerPos.y += dy * stats.speed * speedMult;
      // Clamp to Map
      state.playerPos.x = Math.max(20, Math.min(MAP_WIDTH - 20, state.playerPos.x));
      state.playerPos.y = Math.max(20, Math.min(MAP_HEIGHT - 20, state.playerPos.y));
    }

    // --- Enemy Spawning ---
    state.spawnTimer++;
    const maxEnemies = isWarmup ? 20 : 300; // Increased max enemies for big map
    
    if (state.spawnTimer >= state.spawnRate && state.enemies.length < maxEnemies) {
      state.spawnTimer = 0;
      spawnEnemy(screenWidth, screenHeight);
    }

    // --- Auto Fire ---
    let fireRate = stats.fireRate;
    if (state.specialActive && stats.characterId === 'blitz') fireRate /= 2;

    if (state.frameCount - state.lastShotTime >= fireRate) {
      const target = findNearestEnemy();
      const needsTarget = stats.weaponType !== 'spiral' && stats.weaponType !== 'axe';
      
      if ((needsTarget && target) || !needsTarget) {
         const defaultAngle = state.playerFacingLeft ? Math.PI : 0;
         fireBullet(target, defaultAngle);
         if (audioEnabled) soundEngine.current?.playShoot();
         state.lastShotTime = state.frameCount;
      }
    }

    // --- Update Bullets ---
    for (let i = state.bullets.length - 1; i >= 0; i--) {
      const b = state.bullets[i];
      
      if (b.style === 'axe') {
        b.x += b.vx;
        b.y += b.vy;
        b.vy += 0.5; // Gravity
        b.angle += 0.3; // Spin
      } 
      else if (b.style === 'boomerang') {
        // Slow down and reverse
        if (b.initialVx !== undefined) b.vx -= b.initialVx * 0.03;
        if (b.initialVy !== undefined) b.vy -= b.initialVy * 0.03;
        
        b.x += b.vx;
        b.y += b.vy;
        b.angle += 0.4;
      }
      else if (b.style === 'spiral') {
        // Expand outwards relative to player position
        // This keeps the spiral pattern centered on player even if player moves
        // Logic: Calculate current polar coords, increment, update pos
        
        // Actually, better for 'spiral' is to let them drift like a galaxy
        // Let's make them move outwards from spawn center, but angle shifts
        
        // Simpler implementation: Expanding circle that rotates
        const t = (state.frameCount - (b.spawnFrame || 0));
        const expansionSpeed = stats.bulletSpeed * 0.5;
        const rotationSpeed = 0.05;
        
        // Radius increases
        const r = t * expansionSpeed;
        
        // Angle increases
        // Initial angle is stored in b.angle, but we update visual angle or position?
        // Let's update velocity vector rotation? No, position hard set is easier for patterns
        // But we need origin. Let's use bullet's origin (spawn point) or player?
        // User asked for "distinct", let's make it follow player!
        // That makes it a defensive aura weapon.
        
        const currentAngle = b.angle + (t * rotationSpeed);
        b.x = state.playerPos.x + Math.cos(currentAngle) * r;
        b.y = state.playerPos.y + Math.sin(currentAngle) * r;
        
        // Visual rotation
        b.angle += 0.1;
      }
      else {
        b.x += b.vx;
        b.y += b.vy;
        b.angle += 0.2; 
      }
      
      b.life--;

      if (b.life <= 0 || b.x < 0 || b.x > MAP_WIDTH || b.y < 0 || b.y > MAP_HEIGHT) {
        state.bullets.splice(i, 1);
        continue;
      }

      for (let j = state.enemies.length - 1; j >= 0; j--) {
        const e = state.enemies[j];
        if (checkCollision(b, e)) {
          e.hp -= b.damage;
          
          if (b.style !== 'beam' && b.style !== 'axe' && b.style !== 'boomerang' && b.style !== 'spiral') { 
             // Beams, Axes, Boomerangs, Spirals penetrate infinite or high amount
             b.penetration--;
          }

          if (audioEnabled) soundEngine.current?.playHit();

          if (e.hp <= 0) {
            handleEnemyDeath(e, j);
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
      
      if (state.specialActive && stats.characterId === 'void') {
         // Void pull handled above
      } else {
        if (e.type === 'bat') {
            e.wobbleOffset = (e.wobbleOffset || 0) + 0.1;
            angle += Math.sin(e.wobbleOffset) * 0.5;
        }

        let currentSpeed = e.speed;
        if (state.specialActive && stats.characterId === 'blitz') {
            currentSpeed = 0; 
        }

        e.x += Math.cos(angle) * currentSpeed;
        e.y += Math.sin(angle) * currentSpeed;
      }

      // Check collision with player
      const dist = Math.hypot(e.x - state.playerPos.x, e.y - state.playerPos.y);
      
      // ORBITAL COLLISION
      if (stats.hasOrbitals) {
         const orbitRadius = 80;
         const step = (Math.PI * 2) / stats.orbitalCount;
         for (let o = 0; o < stats.orbitalCount; o++) {
            const oAngle = state.orbitalAngle + (o * step);
            const ox = state.playerPos.x + Math.cos(oAngle) * orbitRadius;
            const oy = state.playerPos.y + Math.sin(oAngle) * orbitRadius;
            const distOrb = Math.hypot(e.x - ox, e.y - oy);
            if (distOrb < e.radius + 10) { // 10 is orbital radius
               e.hp -= stats.orbitalDamage; // damage check
               // Knockback
               e.x -= Math.cos(angle) * 10;
               e.y -= Math.sin(angle) * 10;
               if (e.hp <= 0) handleEnemyDeath(e, i);
            }
         }
      }

      if (dist < e.radius + 15) { 
        const isInvulnerable = state.specialActive && stats.characterId === 'chonk';
        
        if (isInvulnerable) {
            e.hp -= 5;
            if (e.hp <= 0) handleEnemyDeath(e, i);
        } else {
            stats.hp -= e.damage;
            state.enemies.splice(i, 1); 
            onUpdateStats({ hp: stats.hp });
            if (audioEnabled) soundEngine.current?.playHit();
            if (stats.hp <= 0) {
                saveTimeCallback(state.gameTime); 
            }
        }
      }
    }

    // --- Update Gems ---
    for (let i = state.gems.length - 1; i >= 0; i--) {
      const g = state.gems[i];
      const dist = Math.hypot(g.x - state.playerPos.x, g.y - state.playerPos.y);
      
      // Magnet range
      if (dist < 200) {
        const angle = Math.atan2(state.playerPos.y - g.y, state.playerPos.x - g.x);
        const speed = 15 + (200 - dist) / 5;
        g.x += Math.cos(angle) * speed;
        g.y += Math.sin(angle) * speed;
      }

      if (dist < 20) {
        if (g.type === 'health') {
          stats.hp = Math.min(stats.maxHp, stats.hp + g.value);
          if (audioEnabled) soundEngine.current?.playHeal();
          onUpdateStats({ hp: stats.hp });
        } else {
          stats.xp += g.value;
          if (stats.xp >= stats.xpToNextLevel) {
            onLevelUp();
          } else {
             onUpdateStats({ xp: stats.xp });
          }
        }
        state.gems.splice(i, 1);
      }
    }
  };

  const handleEnemyDeath = (e: Enemy, index: number) => {
    const state = gameState.current;
    const stats = statsRef.current;
    
    // Only remove if it hasn't been removed (due to multi-hit frames)
    if (state.enemies[index] !== e) {
        const idx = state.enemies.indexOf(e);
        if (idx > -1) state.enemies.splice(idx, 1);
        else return;
    } else {
        state.enemies.splice(index, 1);
    }

    const isHealthDrop = Math.random() < HEALTH_DROP_CHANCE;
    state.gems.push({
      id: Math.random().toString(),
      x: e.x,
      y: e.y,
      value: isHealthDrop ? HEALTH_DROP_AMOUNT : e.xpValue,
      radius: isHealthDrop ? 8 : 6,
      color: isHealthDrop ? COLORS.health : COLORS.gem,
      vx: 0,
      vy: 0,
      type: isHealthDrop ? 'health' : 'xp'
    });

    stats.killCount++; 
    onUpdateStats({ killCount: stats.killCount });
    if (stats.mana < stats.maxMana) {
        onUpdateStats({ mana: Math.min(stats.maxMana, stats.mana + 5) });
    }
  };

  const spawnEnemy = (screenWidth: number, screenHeight: number) => {
    const state = gameState.current;
    const stats = statsRef.current;
    
    if (state.specialActive && (stats.characterId === 'blitz' || stats.characterId === 'void')) return;

    const levelFactor = 1 + (stats.level * 0.1); 
    const globalMultiplier = state.difficultyMultiplier * levelFactor;

    const rand = Math.random();
    let type: EnemyType = 'mouse';
    
    if (state.gameTime > 120 && rand > 0.95) type = 'ghost';
    else if (state.gameTime > 60 && rand > 0.8) type = 'bat';
    else if (state.gameTime > 30 && rand > 0.85) type = 'bear';
    else if (state.gameTime > 10 && rand > 0.9) type = 'bat';

    const baseStats = ENEMY_TYPES[type];

    // SPAWN AROUND CAMERA, NOT MAP ORIGIN
    const cam = state.camera;
    const side = Math.floor(Math.random() * 4);
    let x = 0, y = 0;
    const padding = 50;
    
    switch(side) {
      case 0: x = cam.x + Math.random() * screenWidth; y = cam.y - padding; break; // Top
      case 1: x = cam.x + screenWidth + padding; y = cam.y + Math.random() * screenHeight; break; // Right
      case 2: x = cam.x + Math.random() * screenWidth; y = cam.y + screenHeight + padding; break; // Bottom
      case 3: x = cam.x - padding; y = cam.y + Math.random() * screenHeight; break; // Left
    }

    // Clamp to map borders so they don't spawn in void
    x = Math.max(0, Math.min(MAP_WIDTH, x));
    y = Math.max(0, Math.min(MAP_HEIGHT, y));

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
    const count = stats.projectileCount;

    // SPIRAL LOGIC
    if (stats.weaponType === 'spiral') {
        const spreadStep = (Math.PI * 2) / Math.max(3, count + 2); 
        for (let i = 0; i < Math.max(3, count + 2); i++) {
            const angle = i * spreadStep;
            state.bullets.push({
                id: Math.random().toString(),
                x: state.playerPos.x,
                y: state.playerPos.y,
                radius: 10,
                vx: 0, 
                vy: 0,
                damage: stats.damage * 0.8,
                penetration: 999,
                life: 180, // 3 seconds
                color: '#ff00ff',
                angle: angle,
                style: 'spiral',
                spawnFrame: state.frameCount
            });
        }
        return;
    }
    
    // AXE LOGIC
    if (stats.weaponType === 'axe') {
        for (let i = 0; i < count; i++) {
            const vx = state.playerFacingLeft ? -4 - (Math.random()*2) : 4 + (Math.random()*2);
            const vy = -15 - (Math.random()*5); // Upwards
            
            state.bullets.push({
                id: Math.random().toString(),
                x: state.playerPos.x,
                y: state.playerPos.y,
                radius: 14,
                vx: vx,
                vy: vy,
                damage: stats.damage * 2, // High damage
                penetration: 999,
                life: 100,
                color: '#ff0000',
                angle: 0,
                style: 'axe'
            });
        }
        return;
    }

    // BOOMERANG LOGIC
    if (stats.weaponType === 'boomerang') {
        let baseAngle = defaultAngle;
        if (target) {
           baseAngle = Math.atan2(target.y - state.playerPos.y, target.x - state.playerPos.x);
        }
        
        const spreadArc = Math.min(Math.PI / 2, count * 0.3);
        
        for(let i=0; i<count; i++) {
             let angle = baseAngle;
             if (count > 1) {
                const startAngle = baseAngle - (spreadArc / 2);
                const step = spreadArc / (count - 1);
                angle = startAngle + (i * step);
             }

             const speed = stats.bulletSpeed * 1.5;
             const vx = Math.cos(angle) * speed;
             const vy = Math.sin(angle) * speed;

             state.bullets.push({
                id: Math.random().toString(),
                x: state.playerPos.x,
                y: state.playerPos.y,
                radius: 12,
                vx: vx,
                vy: vy,
                initialVx: vx,
                initialVy: vy,
                damage: stats.damage * 1.5,
                penetration: 999, // Infinite penetration
                life: 180, // 3 seconds to return
                color: '#00ff00',
                angle: angle,
                style: 'boomerang'
             });
        }
        return;
    }

    // STANDARD LOGIC (Claw, Orb, Beam)
    let baseAngle = defaultAngle;
    if (target) {
      baseAngle = Math.atan2(target.y - state.playerPos.y, target.x - state.playerPos.x);
    } else if (stats.weaponType === 'beam') {
      if (!target) return; 
    }

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

  // --- DRAWING FUNCTIONS (ALL RELATIVE TO CAMERA) ---

  const drawCat = (ctx: CanvasRenderingContext2D, cx: number, cy: number, facingLeft: boolean) => {
    const state = gameState.current;
    const stats = statsRef.current;
    
    ctx.save();
    ctx.translate(cx, cy);
    if (facingLeft) ctx.scale(-1, 1);

    // Special Aura Visuals
    if (state.specialActive) {
        if (stats.characterId === 'chonk') { // Shield
            ctx.beginPath();
            ctx.arc(0,0, 25, 0, Math.PI*2);
            ctx.strokeStyle = '#ffd700';
            ctx.lineWidth = 4;
            ctx.stroke();
            ctx.fillStyle = 'rgba(255, 215, 0, 0.3)';
            ctx.fill();
        }
    }
    
    // PASSIVE AURA VISUAL (Garlic)
    if (stats.hasAura) {
       ctx.beginPath();
       ctx.arc(0, 0, stats.auraRadius, 0, Math.PI*2);
       ctx.fillStyle = 'rgba(255, 100, 100, 0.1)';
       ctx.fill();
       ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)';
       ctx.lineWidth = 1;
       ctx.setLineDash([5, 5]);
       ctx.stroke();
       ctx.setLineDash([]);
    }

    // Body
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fill();
    
    const color = statsRef.current.color; 
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
    
    // DRAW ORBITALS
    if (stats.hasOrbitals) {
        const orbitRadius = 80;
        const step = (Math.PI * 2) / stats.orbitalCount;
        for (let o = 0; o < stats.orbitalCount; o++) {
            const oAngle = state.orbitalAngle + (o * step);
            const ox = cx + Math.cos(oAngle) * orbitRadius;
            const oy = cy + Math.sin(oAngle) * orbitRadius;
            
            ctx.save();
            ctx.translate(ox, oy);
            ctx.rotate(oAngle);
            ctx.fillStyle = '#4488ff';
            ctx.fillRect(-10, -15, 20, 30); // Book shape
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.strokeRect(-10, -15, 20, 30);
            ctx.restore();
        }
    }
  };

  const drawEnemy = (ctx: CanvasRenderingContext2D, e: Enemy, camX: number, camY: number) => {
    // Relative position
    const rx = e.x - camX;
    const ry = e.y - camY;

    // Cull off-screen
    if (rx < -50 || rx > window.innerWidth + 50 || ry < -50 || ry > window.innerHeight + 50) return;

    const state = gameState.current;
    if (state.specialActive && statsRef.current.characterId === 'void') {
         ctx.save();
         ctx.translate(rx, ry);
         ctx.scale(1 - (state.specialTimer / 200), 1); 
         ctx.translate(-rx, -ry);
    } else {
        ctx.save();
    }
    
    ctx.translate(rx, ry);

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
      ctx.fillRect(rx - barW/2, ry - e.radius - 8, barW, 4);
      ctx.fillStyle = '#f00';
      ctx.fillRect(rx - barW/2, ry - e.radius - 8, barW * (e.hp/e.maxHp), 4);
    }
  };

  const drawBullet = (ctx: CanvasRenderingContext2D, b: Bullet, camX: number, camY: number) => {
    const rx = b.x - camX;
    const ry = b.y - camY;

    if (rx < -20 || rx > window.innerWidth + 20 || ry < -20 || ry > window.innerHeight + 20) return;

    ctx.save();
    ctx.translate(rx, ry);
    ctx.rotate(b.angle); 

    ctx.shadowBlur = 10;
    ctx.shadowColor = b.color;
    ctx.fillStyle = b.color;
    ctx.strokeStyle = b.color;

    if (b.style === 'orb') {
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI*2);
      ctx.fill();
    } else if (b.style === 'beam') {
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-10, 0);
      ctx.lineTo(20, 0);
      ctx.stroke();
    } else if (b.style === 'axe') {
      ctx.lineWidth = 0;
      ctx.fillStyle = '#ff3333';
      ctx.beginPath();
      // Draw axe head
      ctx.moveTo(0, -10);
      ctx.quadraticCurveTo(15, -15, 15, 0);
      ctx.quadraticCurveTo(15, 15, 0, 10);
      ctx.lineTo(0, 20); // Handle
      ctx.lineTo(-4, 20);
      ctx.lineTo(-4, -20);
      ctx.lineTo(0, -20);
      ctx.fill();
    } else if (b.style === 'boomerang') {
      ctx.lineWidth = 3;
      ctx.fillStyle = '#33ff33';
      ctx.beginPath();
      // V-shape
      ctx.moveTo(10, 0);
      ctx.lineTo(-5, 8);
      ctx.lineTo(-2, 0);
      ctx.lineTo(-5, -8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (b.style === 'spiral') {
      ctx.lineWidth = 2;
      ctx.fillStyle = '#ff00ff';
      ctx.beginPath();
      // Star shape
      for (let i = 0; i < 5; i++) {
          ctx.lineTo(Math.cos((18 + i * 72) * Math.PI / 180) * 8,
                     Math.sin((18 + i * 72) * Math.PI / 180) * 8);
          ctx.lineTo(Math.cos((54 + i * 72) * Math.PI / 180) * 4,
                     Math.sin((54 + i * 72) * Math.PI / 180) * 4);
      }
      ctx.closePath();
      ctx.fill();
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
    const cam = state.camera;

    // --- DRAW BACKGROUND (GRID) ---
    // Offset grid by camera modulo to create infinite scrolling effect
    const gridSize = 60;
    const offsetX = -cam.x % gridSize;
    const offsetY = -cam.y % gridSize;

    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, width, height);
    
    // Draw Map Borders (if visible)
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 5;
    ctx.strokeRect(-cam.x, -cam.y, MAP_WIDTH, MAP_HEIGHT);

    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for(let x = offsetX; x < width; x += gridSize) { ctx.moveTo(x, 0); ctx.lineTo(x, height); }
    for(let y = offsetY; y < height; y += gridSize) { ctx.moveTo(0, y); ctx.lineTo(width, y); }
    ctx.stroke();

    // --- RENDER SPECIAL EFFECTS (BOTTOM LAYER) ---
    const cx = state.playerPos.x - cam.x;
    const cy = state.playerPos.y - cam.y;

    if (state.specialActive) {
        if (statsRef.current.characterId === 'default') { // Nova
            ctx.beginPath();
            ctx.arc(cx, cy, state.specialEffectRadius, 0, Math.PI*2);
            ctx.strokeStyle = `rgba(255, 255, 255, ${1 - state.specialTimer/30})`;
            ctx.lineWidth = 20;
            ctx.stroke();
        }
        else if (statsRef.current.characterId === 'void') { // Black Hole
            // Center of screen usually
            const bhx = width/2; 
            const bhy = height/2;
            
            ctx.save();
            ctx.translate(bhx, bhy);
            ctx.rotate(state.gameTime / 10);
            ctx.beginPath();
            ctx.arc(0, 0, 50, 0, Math.PI*2);
            ctx.fillStyle = '#000';
            ctx.fill();
            ctx.shadowBlur = 50;
            ctx.shadowColor = '#800080';
            ctx.strokeStyle = '#800080';
            ctx.lineWidth = 5;
            ctx.stroke();
            
            ctx.beginPath();
            ctx.ellipse(0, 0, 150, 40, state.gameTime/5, 0, Math.PI*2);
            ctx.strokeStyle = 'rgba(128, 0, 128, 0.5)';
            ctx.stroke();
            ctx.restore();
        }
    }

    for (const g of state.gems) {
      const rx = g.x - cam.x;
      const ry = g.y - cam.y;
      if (rx < -10 || rx > width+10 || ry < -10 || ry > height+10) continue;

      ctx.shadowBlur = 8;
      ctx.shadowColor = g.color;
      ctx.fillStyle = g.color;
      ctx.beginPath();
      ctx.arc(rx, ry, g.radius, 0, Math.PI * 2);
      ctx.fill();
      
      if (g.type === 'health') {
        ctx.fillStyle = '#fff';
        ctx.fillRect(rx - 4, ry - 1, 8, 2);
        ctx.fillRect(rx - 1, ry - 4, 2, 8);
      }
    }
    ctx.shadowBlur = 0;

    for (const b of state.bullets) {
      drawBullet(ctx, b, cam.x, cam.y);
    }

    for (const e of state.enemies) {
      drawEnemy(ctx, e, cam.x, cam.y);
    }

    drawCat(ctx, cx, cy, state.playerFacingLeft);

    // Horde Warning
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
