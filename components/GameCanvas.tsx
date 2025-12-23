
import React, { useRef, useEffect } from 'react';
import { GameStatus, PlayerStats, Enemy, Bullet, Gem, EnemyType, Particle } from '../types';
import { COLORS, ENEMY_TYPES, MAP_WIDTH, MAP_HEIGHT, CHARACTERS } from '../constants';
import { playSound } from '../utils/SoundManager';

interface GameCanvasProps {
  status: GameStatus;
  playerStats: PlayerStats;
  onUpdateStats: (newStats: Partial<PlayerStats>) => void;
  onLevelUp: () => void;
  onGameOver: () => void;
}

const GameCanvas: React.FC<GameCanvasProps> = ({ status, playerStats, onUpdateStats, onLevelUp, onGameOver }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const skinImageRef = useRef<HTMLCanvasElement | null>(null);

  // AI Skin Background Removal (Chroma Key Black to Alpha)
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
          // AI images often have compression artifacts, so we check a range
          const r = data[i], g = data[i+1], b = data[i+2];
          if (r < 45 && g < 45 && b < 45) {
            data[i+3] = 0;
          }
        }
        oCtx.putImageData(imgData, 0, 0);
        skinImageRef.current = offCanvas;
      };
    } else skinImageRef.current = null;
  }, [playerStats.customSkinUrl]);

  const gameState = useRef({
    keys: {} as Record<string, boolean>,
    playerPos: { x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 },
    camera: { x: 0, y: 0 },
    playerFacingLeft: false,
    enemies: [] as (Enemy & { hitFlash?: number, phase?: number })[],
    bullets: [] as Bullet[],
    gems: [] as Gem[],
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
    if (status === GameStatus.PLAYING) gameState.current.isLevelingUp = false;
  }, [playerStats, status]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const handleResize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    window.addEventListener('resize', handleResize);
    handleResize();

    const handleKeyDown = (e: KeyboardEvent) => { 
      gameState.current.keys[e.code] = true; 
      if (e.code === 'Space') useSpecial();
    };
    const handleKeyUp = (e: KeyboardEvent) => { gameState.current.keys[e.code] = false; };
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 2) useSpecial();
    };

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

  const useSpecial = () => {
    const state = gameState.current;
    const stats = statsRef.current;
    if (stats.mana < stats.maxMana) return;

    onUpdateStats({ mana: 0 });
    playSound('special');
    state.screenShake = 30;

    if (stats.characterId === 'default' || stats.characterId === 'void') {
      state.enemies.forEach(e => {
        const d = Math.hypot(e.x - state.playerPos.x, e.y - state.playerPos.y);
        if (d < 500) e.hp -= 300;
      });
    } else {
      onUpdateStats({ hp: Math.min(stats.maxHp, stats.hp + 50) });
    }
  };

  const spawnEnemy = (sw: number, sh: number) => {
    const state = gameState.current;
    const difficulty = 1 + (state.gameTime / 60);
    const side = Math.floor(Math.random() * 4);
    let x, y;
    const margin = 150;

    if (side === 0) { x = state.camera.x + Math.random() * sw; y = state.camera.y - margin; }
    else if (side === 1) { x = state.camera.x + sw + margin; y = state.camera.y + Math.random() * sh; }
    else if (side === 2) { x = state.camera.x + Math.random() * sw; y = state.camera.y + sh + margin; }
    else { x = state.camera.x - margin; y = state.camera.y + Math.random() * sh; }

    const types: EnemyType[] = ['mouse', 'bat', 'bear', 'ghost'];
    const type = types[Math.floor(Math.random() * Math.min(types.length, 1 + state.gameTime / 45))];
    const base = ENEMY_TYPES[type];

    state.enemies.push({
      id: Math.random().toString(),
      type, x, y, radius: base.radius * (type === 'bear' ? 1.5 : 2),
      hp: base.hpBase * difficulty,
      maxHp: base.hpBase * difficulty,
      speed: base.speed * (1 + state.gameTime / 400), 
      color: base.color,
      damage: base.damage * difficulty, 
      xpValue: base.xp, hitFlash: 0, phase: Math.random() * Math.PI * 2
    });
  };

  const fireBullet = (wpn: string) => {
    const state = gameState.current;
    const stats = statsRef.current;
    let target = null;
    let minDist = 900;
    state.enemies.forEach(e => {
      const d = Math.hypot(e.x - state.playerPos.x, e.y - state.playerPos.y);
      if (d < minDist) { minDist = d; target = e; }
    });
    const baseAngle = target ? Math.atan2(target.y - state.playerPos.y, target.x - state.playerPos.x) : (state.playerFacingLeft ? Math.PI : 0);

    for (let i = 0; i < stats.projectileCount; i++) {
      const angle = baseAngle + (i - (stats.projectileCount - 1) / 2) * 0.2;
      let bRadius = 8;
      let bLife = 120;
      let bColor = COLORS.bullet;
      
      if (wpn === 'axe') { bRadius = 22; bColor = '#ff6600'; bLife = 150; }
      if (wpn === 'beam') { bRadius = 10; bColor = '#00ffff'; bLife = 25; }
      if (wpn === 'claw') { bRadius = 15; bColor = '#00f3ff'; bLife = 40; }
      if (wpn === 'orb') { bRadius = 12; bColor = '#ff00ff'; bLife = 200; }

      state.bullets.push({
        id: Math.random().toString(),
        x: state.playerPos.x, y: state.playerPos.y,
        vx: Math.cos(angle) * stats.bulletSpeed, vy: Math.sin(angle) * stats.bulletSpeed,
        radius: bRadius, damage: stats.damage, penetration: stats.penetration,
        life: bLife, color: bColor,
        angle, style: wpn, prevX: state.playerPos.x, prevY: state.playerPos.y,
        spawnFrame: state.frameCount
      });
    }
    playSound('shoot');
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

    // Hareket
    let mx = 0, my = 0;
    if (state.keys['KeyW'] || state.keys['ArrowUp']) my -= 1;
    if (state.keys['KeyS'] || state.keys['ArrowDown']) my += 1;
    if (state.keys['KeyA'] || state.keys['ArrowLeft']) { mx -= 1; state.playerFacingLeft = true; }
    if (state.keys['KeyD'] || state.keys['ArrowRight']) { mx += 1; state.playerFacingLeft = false; }
    
    if (mx !== 0 || my !== 0) {
      const mag = Math.sqrt(mx*mx + my*my);
      state.playerPos.x += (mx/mag) * stats.speed;
      state.playerPos.y += (my/mag) * stats.speed;
    }

    state.camera.x = state.playerPos.x - sw / 2;
    state.camera.y = state.playerPos.y - sh / 2;

    const spawnRate = Math.max(6, 60 - state.gameTime / 2);
    state.spawnTimer++;
    if (state.spawnTimer > spawnRate) {
      state.spawnTimer = 0;
      if (state.enemies.length < 300) spawnEnemy(sw, sh);
    }

    stats.weapons.forEach(wpn => {
      const last = state.weaponLastShotTimes[wpn] || 0;
      if (state.frameCount - last >= stats.fireRate) {
        fireBullet(wpn);
        state.weaponLastShotTimes[wpn] = state.frameCount;
      }
    });

    for (let i = state.bullets.length - 1; i >= 0; i--) {
      const b = state.bullets[i];
      b.prevX = b.x; b.prevY = b.y;
      
      if (b.style === 'axe') {
        b.angle += 0.2; // Dönme efekti
      }
      
      b.x += b.vx; b.y += b.vy;
      b.life--;
      if (b.life <= 0) { state.bullets.splice(i, 1); continue; }

      for (let j = state.enemies.length - 1; j >= 0; j--) {
        const e = state.enemies[j];
        if (Math.hypot(b.x - e.x, b.y - e.y) < b.radius + e.radius) {
          e.hp -= b.damage; e.hitFlash = 5; b.penetration--;
          playSound('hit');
          if (e.hp <= 0) {
            state.enemies.splice(j, 1);
            state.gems.push({ id: Math.random().toString(), x: e.x, y: e.y, type: 'xp', value: e.xpValue, color: COLORS.gem, radius: 6, vx: 0, vy: 0 });
            onUpdateStats({ killCount: statsRef.current.killCount + 1, mana: Math.min(stats.maxMana, stats.mana + 4) });
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
      e.x += Math.cos(angle) * e.speed;
      e.y += Math.sin(angle) * e.speed;
      if (Math.hypot(e.x - state.playerPos.x, e.y - state.playerPos.y) < e.radius + 15) {
        onUpdateStats({ hp: Math.max(0, stats.hp - e.damage) });
        state.screenShake = 10; state.enemies.splice(i, 1);
        playSound('hurt');
        if (stats.hp <= 0) onGameOver();
      }
    }

    for (let i = state.gems.length - 1; i >= 0; i--) {
      const g = state.gems[i];
      const d = Math.hypot(g.x - state.playerPos.x, g.y - state.playerPos.y);
      if (d < 250) {
        const angle = Math.atan2(state.playerPos.y - g.y, state.playerPos.x - g.x);
        g.x += Math.cos(angle) * 18; g.y += Math.sin(angle) * 18;
      }
      if (d < 35) {
        const nextXp = stats.xp + g.value;
        if (nextXp >= stats.xpToNextLevel) { state.isLevelingUp = true; onLevelUp(); }
        else onUpdateStats({ xp: nextXp });
        state.gems.splice(i, 1); playSound('xp');
      }
    }
  };

  const draw = (ctx: CanvasRenderingContext2D, sw: number, sh: number) => {
    const state = gameState.current;
    const stats = statsRef.current;
    const cam = state.camera;

    ctx.save();
    if (state.screenShake > 0) {
      ctx.translate((Math.random()-0.5)*state.screenShake, (Math.random()-0.5)*state.screenShake);
      state.screenShake *= 0.9;
    }

    ctx.fillStyle = COLORS.background; ctx.fillRect(0, 0, sw, sh);

    // Izgara
    ctx.strokeStyle = '#0d0d2b'; ctx.lineWidth = 2; ctx.beginPath();
    for (let x = -cam.x % 150; x < sw; x += 150) { ctx.moveTo(x, 0); ctx.lineTo(x, sh); }
    for (let y = -cam.y % 150; y < sh; y += 150) { ctx.moveTo(0, y); ctx.lineTo(sw, y); }
    ctx.stroke();

    state.gems.forEach(g => {
      ctx.shadowBlur = 10; ctx.shadowColor = g.color; ctx.fillStyle = g.color;
      ctx.beginPath(); ctx.arc(g.x - cam.x, g.y - cam.y, g.radius, 0, Math.PI*2); ctx.fill();
    });

    // Mermi Çizimleri (Geliştirilmiş)
    state.bullets.forEach(b => {
      ctx.save();
      ctx.translate(b.x - cam.x, b.y - cam.y);
      ctx.rotate(b.angle);
      ctx.shadowBlur = 20; ctx.shadowColor = b.color;
      ctx.fillStyle = b.color;
      
      if (b.style === 'claw') {
        const anim = Math.sin(state.frameCount * 0.3) * 5;
        ctx.beginPath();
        // Üçlü pençe izi
        for(let offset of [-8, 0, 8]) {
          ctx.moveTo(-b.radius, offset);
          ctx.quadraticCurveTo(0, offset + anim, b.radius, offset);
        }
        ctx.lineWidth = 4; ctx.strokeStyle = b.color; ctx.lineCap = 'round'; ctx.stroke();
      } else if (b.style === 'axe') {
        // Balta formu
        ctx.beginPath();
        ctx.moveTo(-15, -15); ctx.lineTo(15, 0); ctx.lineTo(-15, 15);
        ctx.closePath(); ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke();
      } else if (b.style === 'beam') {
        const pulse = Math.sin(state.frameCount * 0.5) * 4 + 8;
        ctx.globalAlpha = 0.8;
        ctx.fillRect(-60, -pulse/2, 120, pulse);
        ctx.fillStyle = '#fff';
        ctx.fillRect(-60, -pulse/4, 120, pulse/2);
      } else if (b.style === 'orb') {
        const pulse = Math.sin(state.frameCount * 0.2) * 3;
        ctx.beginPath(); ctx.arc(0, 0, b.radius + pulse, 0, Math.PI*2); ctx.fill();
        ctx.globalAlpha = 0.3;
        ctx.beginPath(); ctx.arc(0, 0, b.radius * 2, 0, Math.PI*2); ctx.fill();
      } else {
        ctx.beginPath(); ctx.arc(0, 0, b.radius, 0, Math.PI*2); ctx.fill();
      }
      ctx.restore();
    });

    state.enemies.forEach(e => {
      const ex = e.x - cam.x, ey = e.y - cam.y;
      ctx.save();
      ctx.translate(ex, ey);
      ctx.shadowBlur = 20; ctx.shadowColor = e.color;
      ctx.fillStyle = (e.hitFlash && e.hitFlash > 0) ? '#ffffff' : e.color;
      
      if (e.type === 'mouse') {
        ctx.beginPath(); ctx.arc(0, 0, e.radius, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(-e.radius/2, -e.radius/3, 3, 0, Math.PI*2); ctx.arc(e.radius/2, -e.radius/3, 3, 0, Math.PI*2); ctx.fill();
      } else if (e.type === 'bat') {
        const flap = Math.sin(state.frameCount * 0.25) * e.radius;
        ctx.beginPath(); ctx.moveTo(-e.radius - flap, -flap); ctx.lineTo(0, 0); ctx.lineTo(e.radius + flap, -flap); ctx.lineWidth = 3; ctx.strokeStyle = e.color; ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, e.radius/1.5, 0, Math.PI*2); ctx.fill();
      } else if (e.type === 'bear') {
        ctx.beginPath(); ctx.arc(0, 0, e.radius, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(-e.radius/3, -e.radius/4, 4, 0, Math.PI*2); ctx.arc(e.radius/3, -e.radius/4, 4, 0, Math.PI*2); ctx.fill();
      } else {
        ctx.globalAlpha = 0.5;
        ctx.beginPath(); ctx.arc(0, 0, e.radius, 0, Math.PI*2); ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
      }
      ctx.restore();
      
      if (e.hp < e.maxHp) {
        ctx.fillStyle = '#111'; ctx.fillRect(ex - e.radius, ey - e.radius - 12, e.radius*2, 5);
        ctx.fillStyle = '#ff3300'; ctx.fillRect(ex - e.radius, ey - e.radius - 12, (e.radius*2) * (e.hp/e.maxHp), 5);
      }
    });

    const px = state.playerPos.x - cam.x, py = state.playerPos.y - cam.y;
    ctx.save();
    ctx.translate(px, py);
    if (state.playerFacingLeft) ctx.scale(-1, 1);
    
    if (skinImageRef.current) {
      ctx.shadowBlur = 45; ctx.shadowColor = stats.color;
      ctx.drawImage(skinImageRef.current, -50, -50, 100, 100);
    } else {
      ctx.shadowBlur = 45; ctx.shadowColor = stats.color;
      // Procedural Neon Cat
      ctx.fillStyle = stats.color;
      ctx.beginPath(); ctx.arc(0, 0, 25, 0, Math.PI*2); ctx.fill();
      // Ears
      ctx.beginPath(); ctx.moveTo(-20, -15); ctx.lineTo(-25, -35); ctx.lineTo(-5, -25); ctx.fill();
      ctx.beginPath(); ctx.moveTo(20, -15); ctx.lineTo(25, -35); ctx.lineTo(5, -25); ctx.fill();
      // Eyes
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(-8, -5, 5, 0, Math.PI*2); ctx.arc(8, -5, 5, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(-7, -6, 2, 0, Math.PI*2); ctx.arc(9, -6, 2, 0, Math.PI*2); ctx.fill();
    }
    ctx.restore();
    ctx.restore();
  };

  return <canvas ref={canvasRef} className="block w-full h-full" onContextMenu={(e) => e.preventDefault()} />;
};

export default GameCanvas;
