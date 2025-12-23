
import React, { useRef, useEffect } from 'react';
import { GameStatus, PlayerStats, Enemy, Bullet, Gem, EnemyType, GemType, MapType } from '../types';
import { COLORS, ENEMY_TYPES, MAP_WIDTH, MAP_HEIGHT, PICKUP_CHANCES, MAP_CONFIGS } from '../constants';
import { playSound } from '../utils/SoundManager';

interface GameCanvasProps {
  status: GameStatus;
  playerStats: PlayerStats;
  onUpdateStats: (newStats: Partial<PlayerStats>) => void;
  onLevelUp: () => void;
  onGameOver: () => void;
}

interface Effect {
  x: number;
  y: number;
  radius: number;
  life: number;
  maxLife: number;
  color: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  maxLife: number;
  color: string;
  type: 'shard' | 'plus' | 'spark' | 'ember';
}

interface TerrainObject {
  x: number;
  y: number;
  size: number;
  color: string;
  type: 'tree' | 'rock' | 'cactus' | 'lava_vent';
}

const GameCanvas: React.FC<GameCanvasProps> = ({ status, playerStats, onUpdateStats, onLevelUp, onGameOver }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const skinImageRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (playerStats.customSkinUrl) {
      const img = new Image();
      img.src = playerStats.customSkinUrl;
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const offCanvas = document.createElement('canvas');
        offCanvas.width = img.width; offCanvas.height = img.height;
        const oCtx = offCanvas.getContext('2d');
        if (!oCtx) return;
        oCtx.drawImage(img, 0, 0);
        const imgData = oCtx.getImageData(0, 0, offCanvas.width, offCanvas.height);
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i] < 35 && data[i+1] < 35 && data[i+2] < 35) data[i+3] = 0;
        }
        oCtx.putImageData(imgData, 0, 0);
        skinImageRef.current = offCanvas;
      };
    } else skinImageRef.current = null;
  }, [playerStats.customSkinUrl]);

  const gameState = useRef({
    keys: {} as Record<string, boolean>,
    playerPos: { x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 },
    playerVel: { x: 0, y: 0 },
    camera: { x: 0, y: 0 },
    playerFacingLeft: false,
    enemies: [] as Enemy[],
    bullets: [] as Bullet[],
    gems: [] as Gem[],
    effects: [] as Effect[],
    particles: [] as Particle[],
    terrain: [] as TerrainObject[],
    weaponLastShotTimes: {} as Record<string, number>,
    spawnTimer: 0,
    frameCount: 0,
    gameTime: 0,
    screenShake: 0,
    isLevelingUp: false,
  });

  const statsRef = useRef(playerStats);
  useEffect(() => { 
    statsRef.current = playerStats;
    if (status === GameStatus.PLAYING) {
      gameState.current.isLevelingUp = false;
      // Initialize terrain objects once
      generateTerrain(playerStats.selectedMap);
    }
  }, [playerStats, status]);

  const generateTerrain = (mapType: MapType) => {
    const state = gameState.current;
    if (state.terrain.length > 0) return;
    const count = 150;
    const cfg = MAP_CONFIGS[mapType];
    for (let i = 0; i < count; i++) {
      state.terrain.push({
        x: Math.random() * MAP_WIDTH,
        y: Math.random() * MAP_HEIGHT,
        size: 20 + Math.random() * 40,
        color: cfg.accentColor,
        type: mapType === 'forest' ? 'tree' : mapType === 'desert' ? 'cactus' : 'lava_vent'
      });
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const handleResize = () => { 
      canvas.width = window.innerWidth; 
      canvas.height = window.innerHeight; 
    };
    window.addEventListener('resize', handleResize);
    handleResize();

    const handleKeyDown = (e: KeyboardEvent) => { 
      gameState.current.keys[e.code] = true; 
      if (e.code === 'Space') useSpecial();
    };
    const handleKeyUp = (e: KeyboardEvent) => { gameState.current.keys[e.code] = false; };
    const handleMouseDown = (e: MouseEvent) => { if (e.button === 2) useSpecial(); };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousedown', handleMouseDown);

    let animationFrameId: number;
    const loop = () => {
      if (status === GameStatus.PLAYING) update(canvas.width, canvas.height);
      draw(ctx, canvas.width, canvas.height);
      animationFrameId = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousedown', handleMouseDown);
      cancelAnimationFrame(animationFrameId);
    };
  }, [status]);

  const createCollectionBurst = (x: number, y: number, color: string, type: GemType) => {
    const state = gameState.current;
    let count = 8;
    let pType: Particle['type'] = 'shard';
    
    if (type === 'health') { count = 5; pType = 'plus'; }
    if (type === 'magnet') { count = 12; pType = 'spark'; }
    if (type === 'bomb') { count = 20; pType = 'ember'; }

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const force = Math.random() * 5 + 2;
      state.particles.push({
        x, y,
        vx: Math.cos(angle) * force,
        vy: Math.sin(angle) * force + (type === 'health' ? -2 : 0),
        size: Math.random() * 4 + 2,
        life: 40,
        maxLife: 40,
        color,
        type: pType
      });
    }
  };

  const useSpecial = () => {
    const state = gameState.current;
    if (statsRef.current.mana < statsRef.current.maxMana) return;
    onUpdateStats({ mana: 0 });
    playSound('special');
    state.screenShake = 40;
    state.enemies.forEach(e => {
      const d = Math.hypot(e.x - state.playerPos.x, e.y - state.playerPos.y);
      if (d < 700) {
        e.hp -= 600;
        e.hitFlash = 5;
      }
    });
    state.effects.push({ x: state.playerPos.x, y: state.playerPos.y, radius: 700, life: 30, maxLife: 30, color: 'rgba(0, 243, 255, 0.4)' });
  };

  const spawnEnemy = (sw: number, sh: number) => {
    const state = gameState.current;
    const stats = statsRef.current;
    const mapCfg = MAP_CONFIGS[stats.selectedMap];
    const difficulty = 1 + (state.gameTime / 180);
    const side = Math.floor(Math.random() * 4);
    let x, y;
    const margin = 200;

    if (side === 0) { x = state.camera.x + Math.random() * sw; y = state.camera.y - margin; }
    else if (side === 1) { x = state.camera.x + sw + margin; y = state.camera.y + Math.random() * sh; }
    else if (side === 2) { x = state.camera.x + Math.random() * sw; y = state.camera.y + sh + margin; }
    else { x = state.camera.x - margin; y = state.camera.y + Math.random() * sh; }

    // Map Specific enemy selection
    const pool = mapCfg.enemyPool;
    const type = pool[Math.floor(Math.random() * pool.length)];
    const base = ENEMY_TYPES[type];

    state.enemies.push({
      id: Math.random().toString(),
      type, x, y, radius: base.radius,
      hp: base.hpBase * difficulty,
      maxHp: base.hpBase * difficulty,
      speed: base.speed * (1 + state.gameTime / 1200),
      color: base.color,
      damage: base.damage * difficulty, 
      xpValue: base.xp, hitFlash: 0
    });
  };

  const update = (sw: number, sh: number) => {
    const state = gameState.current;
    const stats = statsRef.current;
    if (state.isLevelingUp) return;

    state.frameCount++;
    if (state.frameCount % 60 === 0) {
      state.gameTime++;
      onUpdateStats({ survivalTime: state.gameTime, mana: Math.min(stats.maxMana, stats.mana + 1) });
    }

    // Particle logic
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      p.x += p.vx; p.y += p.vy; p.life--;
      if (p.type === 'plus') p.vy -= 0.05; 
      if (p.type === 'ember') { p.vx *= 0.98; p.vy *= 0.98; } 
      if (p.life <= 0) state.particles.splice(i, 1);
    }

    for (let i = state.effects.length - 1; i >= 0; i--) {
      state.effects[i].life--;
      if (state.effects[i].life <= 0) state.effects.splice(i, 1);
    }

    let mx = 0, my = 0;
    if (state.keys['KeyW'] || state.keys['ArrowUp']) my -= 1;
    if (state.keys['KeyS'] || state.keys['ArrowDown']) my += 1;
    if (state.keys['KeyA'] || state.keys['ArrowLeft']) { mx -= 1; state.playerFacingLeft = true; }
    if (state.keys['KeyD'] || state.keys['ArrowRight']) { mx += 1; state.playerFacingLeft = false; }
    
    if (mx !== 0 || my !== 0) {
      const mag = Math.sqrt(mx*mx + my*my);
      state.playerVel.x = (mx/mag) * stats.speed;
      state.playerVel.y = (my/mag) * stats.speed;
      state.playerPos.x += state.playerVel.x;
      state.playerPos.y += state.playerVel.y;
    } else {
      state.playerVel.x *= 0.8;
      state.playerVel.y *= 0.8;
    }

    // Wrap around or clamp? Let's use survivors infinite logic (wrap pos loosely)
    state.camera.x = state.playerPos.x - sw / 2;
    state.camera.y = state.playerPos.y - sh / 2;

    const spawnInterval = Math.max(8, 70 - state.gameTime / 1.5);
    if (state.frameCount % Math.floor(spawnInterval) === 0 && state.enemies.length < 500) spawnEnemy(sw, sh);

    stats.weapons.forEach(wpn => {
      const last = state.weaponLastShotTimes[wpn] || 0;
      if (state.frameCount - last >= stats.fireRate) {
        let target = null;
        let minDist = 1200;
        state.enemies.forEach(e => {
          const d = Math.hypot(e.x - state.playerPos.x, e.y - state.playerPos.y);
          if (d < minDist) { minDist = d; target = e; }
        });
        const angle = target ? Math.atan2(target.y - state.playerPos.y, target.x - state.playerPos.x) : (state.playerFacingLeft ? Math.PI : 0);
        
        for (let i = 0; i < stats.projectileCount; i++) {
          const spread = angle + (i - (stats.projectileCount - 1) / 2) * 0.12;
          state.bullets.push({
            id: Math.random().toString(),
            x: state.playerPos.x, y: state.playerPos.y,
            vx: Math.cos(spread) * stats.bulletSpeed, vy: Math.sin(spread) * stats.bulletSpeed,
            radius: wpn === 'axe' ? 32 : wpn === 'orb' ? 18 : 12, 
            damage: stats.damage, penetration: stats.penetration,
            life: wpn === 'beam' ? 25 : 200, 
            color: wpn === 'axe' ? '#ea580c' : wpn === 'beam' ? '#06b6d4' : wpn === 'orb' ? '#d946ef' : COLORS.bullet,
            angle: spread, style: wpn, spawnFrame: state.frameCount
          });
        }
        state.weaponLastShotTimes[wpn] = state.frameCount;
        playSound('shoot');
      }
    });

    for (let i = state.bullets.length - 1; i >= 0; i--) {
      const b = state.bullets[i];
      if (b.style === 'axe') b.angle += 0.3;
      b.x += b.vx; b.y += b.vy; b.life--;
      if (b.life <= 0) { state.bullets.splice(i, 1); continue; }

      for (let j = state.enemies.length - 1; j >= 0; j--) {
        const e = state.enemies[j];
        if (Math.hypot(b.x - e.x, b.y - e.y) < b.radius + e.radius) {
          e.hp -= b.damage; e.hitFlash = 5; b.penetration--;
          playSound('hit');
          if (e.hp <= 0) {
            state.enemies.splice(j, 1);
            onUpdateStats({ killCount: statsRef.current.killCount + 1, mana: Math.min(stats.maxMana, stats.mana + 5) });
            
            const rnd = Math.random();
            let gType: GemType = 'xp';
            let color = COLORS.gem;
            
            if (rnd < PICKUP_CHANCES.bomb) { gType = 'bomb'; color = COLORS.bomb; }
            else if (rnd < PICKUP_CHANCES.magnet) { gType = 'magnet'; color = COLORS.magnet; }
            else if (rnd < PICKUP_CHANCES.health) { gType = 'health'; color = COLORS.health; }

            state.gems.push({ id: Math.random().toString(), x: e.x, y: e.y, type: gType, value: e.xpValue, color, radius: 9, vx: 0, vy: 0, isBeingMagnetized: false });
            playSound('kill');
          }
          if (b.penetration <= 0) { state.bullets.splice(i, 1); break; }
        }
      }
    }

    for (let i = state.enemies.length - 1; i >= 0; i--) {
      const e = state.enemies[i];
      if (e.hitFlash && e.hitFlash > 0) e.hitFlash--;
      const angle = Math.atan2(state.playerPos.y - e.y, state.playerPos.x - e.x);
      
      let speed = e.speed;
      let finalAngle = angle;
      if (e.type === 'snake') {
        finalAngle += Math.sin(state.frameCount * 0.1) * 0.8;
      }
      
      e.x += Math.cos(finalAngle) * speed;
      e.y += Math.sin(finalAngle) * speed;
      
      if (Math.hypot(e.x - state.playerPos.x, e.y - state.playerPos.y) < e.radius + 20) {
        onUpdateStats({ hp: Math.max(0, stats.hp - e.damage) });
        state.screenShake = 20; 
        if (e.type !== 'dragon') state.enemies.splice(i, 1); 
        playSound('hurt');
        if (stats.hp <= 0) onGameOver();
      }
    }

    for (let i = state.gems.length - 1; i >= 0; i--) {
      const g = state.gems[i];
      const d = Math.hypot(g.x - state.playerPos.x, g.y - state.playerPos.y);
      
      if (d < 350 || g.isBeingMagnetized) {
        const angle = Math.atan2(state.playerPos.y - g.y, state.playerPos.x - g.x);
        const speed = g.isBeingMagnetized ? 25 : 18;
        g.x += Math.cos(angle) * speed; g.y += Math.sin(angle) * speed;
      }

      if (d < 50) {
        createCollectionBurst(g.x, g.y, g.color, g.type);
        if (g.type === 'health') {
          onUpdateStats({ hp: Math.min(stats.maxHp, stats.hp + 35) });
          state.effects.push({ x: g.x, y: g.y, radius: 100, life: 15, maxLife: 15, color: 'rgba(255, 0, 51, 0.4)' });
        }
        else if (g.type === 'magnet') {
          state.gems.forEach(o => { if (o.type === 'xp') o.isBeingMagnetized = true; });
          state.effects.push({ x: state.playerPos.x, y: state.playerPos.y, radius: 1500, life: 40, maxLife: 40, color: 'rgba(0, 170, 255, 0.2)' });
        }
        else if (g.type === 'bomb') {
          const bombRadius = 1000;
          state.enemies.forEach(e => {
            const ed = Math.hypot(e.x - g.x, e.y - g.y);
            if (ed < bombRadius) {
              e.hp -= 400;
              e.hitFlash = 10;
            }
          });
          state.screenShake = 50;
          state.effects.push({ x: g.x, y: g.y, radius: bombRadius, life: 25, maxLife: 25, color: 'rgba(255, 170, 0, 0.6)' });
          playSound('special');
        }
        else {
          const nextXp = stats.xp + g.value;
          if (nextXp >= stats.xpToNextLevel) { state.isLevelingUp = true; onLevelUp(); }
          else onUpdateStats({ xp: nextXp });
        }
        state.gems.splice(i, 1); playSound('xp');
      }
    }
  };

  const draw = (ctx: CanvasRenderingContext2D, sw: number, sh: number) => {
    const state = gameState.current;
    const stats = statsRef.current;
    const cam = state.camera;
    const mapCfg = MAP_CONFIGS[stats.selectedMap];

    ctx.save();
    if (state.screenShake > 0) {
      ctx.translate((Math.random()-0.5)*state.screenShake, (Math.random()-0.5)*state.screenShake);
      state.screenShake *= 0.85;
    }

    // Ground Rendering
    ctx.fillStyle = mapCfg.bgColor; ctx.fillRect(0, 0, sw, sh);
    
    // Draw Environment Pattern (Ground Texture)
    ctx.strokeStyle = mapCfg.gridColor; ctx.lineWidth = 1; 
    const step = 150;
    ctx.beginPath();
    for (let x = -cam.x % step; x < sw; x += step) {
      for (let y = -cam.y % step; y < sh; y += step) {
        if (stats.selectedMap === 'forest') {
          // Vine patterns
          ctx.moveTo(x, y); ctx.lineTo(x + 20, y + 20);
        } else if (stats.selectedMap === 'desert') {
          // Wind ripples
          ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 75, y + 20, x + 150, y);
        } else {
          // Lava cracks
          ctx.moveTo(x, y); ctx.lineTo(x + Math.sin(state.frameCount * 0.01) * 30, y + 100);
        }
      }
    }
    ctx.stroke();

    // Terrain objects
    state.terrain.forEach(obj => {
      const ox = obj.x - cam.x, oy = obj.y - cam.y;
      if (ox < -100 || ox > sw + 100 || oy < -100 || oy > sh + 100) return;
      ctx.save();
      ctx.translate(ox, oy);
      ctx.shadowBlur = 10; ctx.shadowColor = obj.color;
      ctx.fillStyle = obj.color + '44'; // Semi transparent
      if (obj.type === 'tree') {
        ctx.beginPath(); ctx.arc(0, 0, obj.size, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = obj.color; ctx.lineWidth = 2; ctx.stroke();
      } else if (obj.type === 'cactus') {
        ctx.fillRect(-10, -obj.size, 20, obj.size);
        ctx.fillRect(-25, -obj.size * 0.6, 15, 10);
        ctx.fillRect(10, -obj.size * 0.8, 15, 10);
      } else {
        // Lava vent
        const pulsate = Math.sin(state.frameCount * 0.05) * 10;
        ctx.fillStyle = '#ff4400';
        ctx.beginPath(); ctx.ellipse(0, 0, obj.size + pulsate, obj.size * 0.3, 0, 0, Math.PI*2); ctx.fill();
      }
      ctx.restore();
    });

    // Particles
    state.particles.forEach(p => {
      ctx.save();
      ctx.globalAlpha = p.life / p.maxLife;
      ctx.fillStyle = p.color;
      ctx.translate(p.x - cam.x, p.y - cam.y);
      if (p.type === 'shard') {
        ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size);
      } else if (p.type === 'plus') {
        ctx.fillRect(-p.size/2, -p.size*1.5, p.size, p.size*3);
        ctx.fillRect(-p.size*1.5, -p.size/2, p.size*3, p.size);
      } else if (p.type === 'spark') {
        ctx.beginPath(); ctx.arc(0, 0, p.size, 0, Math.PI*2); ctx.fill();
      } else if (p.type === 'ember') {
        ctx.beginPath(); ctx.arc(0, 0, p.size*1.5, 0, Math.PI*2); ctx.fill();
      }
      ctx.restore();
    });

    state.effects.forEach(fx => {
      ctx.save();
      const alpha = (fx.life / fx.maxLife);
      ctx.strokeStyle = fx.color.replace('0.4', alpha.toString());
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(fx.x - cam.x, fx.y - cam.y, fx.radius * (1 - alpha * 0.5), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    });

    state.gems.forEach(g => {
      ctx.save();
      const pulse = Math.sin(state.frameCount * 0.1) * 2;
      ctx.shadowBlur = 15; ctx.shadowColor = g.color;
      ctx.fillStyle = g.color;
      ctx.translate(g.x - cam.x, g.y - cam.y);
      if (g.type === 'bomb') {
        const spikeCount = 8;
        ctx.beginPath();
        for (let i = 0; i < spikeCount * 2; i++) {
          const radius = i % 2 === 0 ? g.radius + pulse : (g.radius * 0.5) + pulse;
          const angle = (i / spikeCount) * Math.PI;
          ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
        }
        ctx.closePath(); ctx.fill();
      } else if (g.type === 'health') {
        const size = g.radius + pulse;
        ctx.fillRect(-size/4, -size, size/2, size*2);
        ctx.fillRect(-size, -size/4, size*2, size/2);
      } else if (g.type === 'magnet') {
        ctx.lineWidth = 3; ctx.strokeStyle = g.color;
        ctx.beginPath(); ctx.arc(0, 0, g.radius + pulse, Math.PI, 0); ctx.stroke();
      } else {
        ctx.rotate(state.frameCount * 0.05);
        ctx.beginPath();
        ctx.moveTo(0, -(g.radius + pulse)); ctx.lineTo(g.radius + pulse, 0);
        ctx.lineTo(0, g.radius + pulse); ctx.lineTo(-(g.radius + pulse), 0);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    });

    state.bullets.forEach(b => {
      ctx.save();
      ctx.translate(b.x - cam.x, b.y - cam.y);
      ctx.rotate(b.angle);
      ctx.shadowBlur = 20; ctx.shadowColor = b.color;
      ctx.fillStyle = b.color;
      if (b.style === 'claw') {
        ctx.beginPath();
        for(let off of [-8, 0, 8]) { ctx.moveTo(-15, off); ctx.quadraticCurveTo(8, off + Math.sin(state.frameCount*0.3)*6, 15, off); }
        ctx.lineWidth = 4; ctx.strokeStyle = b.color; ctx.stroke();
      } else if (b.style === 'axe') {
        ctx.beginPath(); ctx.moveTo(-22,-22); ctx.lineTo(22,0); ctx.lineTo(-22,22); ctx.closePath(); ctx.fill();
      } else if (b.style === 'beam') {
        const p = Math.sin(state.frameCount * 0.4) * 6 + 12;
        ctx.fillRect(-100, -p/2, 200, p);
      } else if (b.style === 'orb') {
        ctx.beginPath(); ctx.arc(0, 0, b.radius + Math.sin(state.frameCount * 0.2) * 5, 0, Math.PI*2); ctx.fill();
      } else {
        ctx.beginPath(); ctx.arc(0, 0, b.radius, 0, Math.PI*2); ctx.fill();
      }
      ctx.restore();
    });

    state.enemies.forEach(e => {
      const ex = e.x - cam.x, ey = e.y - cam.y;
      if (ex < -200 || ex > sw + 200 || ey < -200 || ey > sh + 200) return;
      ctx.save();
      ctx.translate(ex, ey);
      ctx.shadowBlur = 15; ctx.shadowColor = e.color;
      ctx.fillStyle = e.hitFlash ? '#fff' : e.color;
      const anim = Math.sin(state.frameCount * 0.1) * 2;
      
      if (e.type === 'skeleton') {
        ctx.beginPath(); ctx.arc(0, -e.radius/2 + anim, e.radius/1.4, 0, Math.PI*2); ctx.fill();
        for(let i=0; i<3; i++) ctx.fillRect(-e.radius/1.5, i*7 + anim, e.radius*1.3, 3);
      } else if (e.type === 'orc') {
        ctx.beginPath(); ctx.arc(0, anim, e.radius, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#1f2937'; ctx.fillRect(-e.radius, -e.radius/3 + anim, e.radius*2, 12);
      } else if (e.type === 'vampire') {
        ctx.beginPath(); ctx.moveTo(-e.radius*1.2, -e.radius+anim); ctx.lineTo(0, e.radius*1.5+anim); ctx.lineTo(e.radius*1.2, -e.radius+anim); ctx.closePath(); ctx.fill();
      } else if (e.type === 'snake') {
        const ang = Math.atan2(state.playerPos.y - e.y, state.playerPos.x - e.x);
        for (let i = 0; i < 5; i++) {
          const sinBody = Math.sin((state.frameCount - i * 5) * 0.15) * 12;
          ctx.beginPath(); ctx.arc(-Math.cos(ang)*i*14 + Math.cos(ang+Math.PI/2)*sinBody, -Math.sin(ang)*i*14 + Math.sin(ang+Math.PI/2)*sinBody, e.radius-i*1.5, 0, Math.PI*2); ctx.fill();
        }
      } else if (e.type === 'dragon') {
        const flap = Math.sin(state.frameCount * 0.08) * 40;
        ctx.save(); ctx.rotate(Math.atan2(state.playerPos.y-e.y, state.playerPos.x-e.x));
        ctx.fillStyle = e.color+'44';
        ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(-40, -60-flap); ctx.lineTo(40,-40); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(-40, 60+flap); ctx.lineTo(40,40); ctx.closePath(); ctx.fill();
        ctx.fillStyle = e.hitFlash ? '#fff' : e.color;
        ctx.beginPath(); ctx.ellipse(0,0, e.radius, e.radius*0.6, 0, 0, Math.PI*2); ctx.fill();
        ctx.restore();
      } else if (e.type === 'scorpion') {
        ctx.beginPath(); ctx.ellipse(0, anim, e.radius*1.4, e.radius, 0, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(-e.radius, anim); ctx.quadraticCurveTo(-e.radius*2, -e.radius*2, 0, -e.radius*2); ctx.lineWidth=4; ctx.strokeStyle=e.color; ctx.stroke();
      } else if (e.type === 'imp') {
        ctx.globalAlpha = 0.6;
        ctx.beginPath(); ctx.arc(0, anim, e.radius + Math.sin(state.frameCount*0.2)*4, 0, Math.PI*2); ctx.fill();
        ctx.globalAlpha = 1;
      } else {
        const flap = Math.sin(state.frameCount * 0.4) * e.radius;
        ctx.beginPath(); ctx.arc(0, anim, e.radius/1.2, 0, Math.PI*2); ctx.fill();
      }
      ctx.restore();
    });

    const px = state.playerPos.x - cam.x, py = state.playerPos.y - cam.y;
    const floatAnim = Math.sin(state.frameCount * 0.15) * 4;
    ctx.save(); ctx.translate(px, py + 35); ctx.scale(1, 0.4); ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.arc(0, 0, 25 - floatAnim/2, 0, Math.PI*2); ctx.fill(); ctx.restore();

    ctx.save(); ctx.translate(px, py + floatAnim);
    if (state.playerFacingLeft) ctx.scale(-1, 1);
    ctx.shadowBlur = 45; ctx.shadowColor = stats.color;
    if (skinImageRef.current) {
      ctx.drawImage(skinImageRef.current, -60, -60, 120, 120);
    } else {
      ctx.fillStyle = stats.color; 
      ctx.beginPath(); ctx.arc(0, 0, 28, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle='#000'; ctx.beginPath(); ctx.arc(-10,-8,6,0,Math.PI*2); ctx.arc(10,-8,6,0,Math.PI*2); ctx.fill();
    }
    ctx.restore(); ctx.restore();
  };

  return <canvas ref={canvasRef} className="block w-full h-full" onContextMenu={(e) => e.preventDefault()} />;
};

export default GameCanvas;
