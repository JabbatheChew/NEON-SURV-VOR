
import React, { useRef, useEffect } from 'react';
import { GameStatus, PlayerStats, Enemy, Bullet, Gem, EnemyType, GemType } from '../types';
import { COLORS, ENEMY_TYPES, MAP_WIDTH, MAP_HEIGHT, PICKUP_CHANCES } from '../constants';
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
    camera: { x: 0, y: 0 },
    playerFacingLeft: false,
    enemies: [] as Enemy[],
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

  const useSpecial = () => {
    const state = gameState.current;
    if (statsRef.current.mana < statsRef.current.maxMana) return;
    onUpdateStats({ mana: 0 });
    playSound('special');
    state.screenShake = 40;
    state.enemies.forEach(e => {
      const d = Math.hypot(e.x - state.playerPos.x, e.y - state.playerPos.y);
      if (d < 700) e.hp -= 600;
    });
  };

  const spawnEnemy = (sw: number, sh: number) => {
    const state = gameState.current;
    // Zorluk ölçeklendirmesi yumuşatıldı: gameTime / 60 -> 180
    const difficulty = 1 + (state.gameTime / 180);
    const side = Math.floor(Math.random() * 4);
    let x, y;
    const margin = 200;

    if (side === 0) { x = state.camera.x + Math.random() * sw; y = state.camera.y - margin; }
    else if (side === 1) { x = state.camera.x + sw + margin; y = state.camera.y + Math.random() * sh; }
    else if (side === 2) { x = state.camera.x + Math.random() * sw; y = state.camera.y + sh + margin; }
    else { x = state.camera.x - margin; y = state.camera.y + Math.random() * sh; }

    const types: EnemyType[] = ['skeleton', 'bat', 'orc', 'vampire'];
    // Yeni düşmanların gelmesi geciktirildi: /50 -> /120
    const type = types[Math.floor(Math.random() * Math.min(types.length, 1 + state.gameTime / 120))];
    const base = ENEMY_TYPES[type];

    state.enemies.push({
      id: Math.random().toString(),
      type, x, y, radius: base.radius,
      hp: base.hpBase * difficulty,
      maxHp: base.hpBase * difficulty,
      speed: base.speed * (1 + state.gameTime / 1200), // Hız artışı yavaşlatıldı
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

    // Başlangıç doğuş hızı yavaşlatıldı: 40 -> 70
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
            if (rnd < PICKUP_CHANCES.health) { gType = 'health'; color = COLORS.health; }
            else if (rnd < PICKUP_CHANCES.magnet) { gType = 'magnet'; color = COLORS.magnet; }
            else if (rnd < PICKUP_CHANCES.bomb) { gType = 'bomb'; color = COLORS.bomb; }
            state.gems.push({ id: Math.random().toString(), x: e.x, y: e.y, type: gType, value: e.xpValue, color, radius: 9, vx: 0, vy: 0 });
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
      if (Math.hypot(e.x - state.playerPos.x, e.y - state.playerPos.y) < e.radius + 20) {
        onUpdateStats({ hp: Math.max(0, stats.hp - e.damage) });
        state.screenShake = 20; state.enemies.splice(i, 1);
        playSound('hurt');
        if (stats.hp <= 0) onGameOver();
      }
    }

    for (let i = state.gems.length - 1; i >= 0; i--) {
      const g = state.gems[i];
      const d = Math.hypot(g.x - state.playerPos.x, g.y - state.playerPos.y);
      if (d < 350) {
        const angle = Math.atan2(state.playerPos.y - g.y, state.playerPos.x - g.x);
        g.x += Math.cos(angle) * 18; g.y += Math.sin(angle) * 18;
      }
      if (d < 50) {
        if (g.type === 'health') onUpdateStats({ hp: Math.min(stats.maxHp, stats.hp + 35) });
        else if (g.type === 'magnet') state.gems.forEach(o => { if (o.type === 'xp') { o.x = state.playerPos.x; o.y = state.playerPos.y; } });
        else if (g.type === 'bomb') { state.enemies.forEach(e => { e.hp -= 300; e.hitFlash = 5; }); state.screenShake = 30; }
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

    ctx.save();
    if (state.screenShake > 0) {
      ctx.translate((Math.random()-0.5)*state.screenShake, (Math.random()-0.5)*state.screenShake);
      state.screenShake *= 0.85;
    }

    ctx.fillStyle = COLORS.background; ctx.fillRect(0, 0, sw, sh);
    ctx.strokeStyle = '#0d0d21'; ctx.lineWidth = 1; ctx.beginPath();
    const grid = 200;
    for (let x = -cam.x % grid; x < sw; x += grid) { ctx.moveTo(x, 0); ctx.lineTo(x, sh); }
    for (let y = -cam.y % grid; y < sh; y += grid) { ctx.moveTo(0, y); ctx.lineTo(sw, y); }
    ctx.stroke();

    state.gems.forEach(g => {
      ctx.shadowBlur = 15; ctx.shadowColor = g.color; ctx.fillStyle = g.color;
      ctx.beginPath(); ctx.arc(g.x - cam.x, g.y - cam.y, g.radius, 0, Math.PI*2); ctx.fill();
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
        ctx.lineWidth = 4; ctx.strokeStyle = b.color; ctx.lineCap = 'round'; ctx.stroke();
      } else if (b.style === 'axe') {
        ctx.beginPath(); ctx.moveTo(-22,-22); ctx.lineTo(22,0); ctx.lineTo(-22,22); ctx.closePath(); ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
      } else if (b.style === 'beam') {
        const p = Math.sin(state.frameCount * 0.4) * 6 + 12;
        ctx.fillRect(-100, -p/2, 200, p);
        ctx.fillStyle = '#fff'; ctx.fillRect(-100, -p/4, 200, p/2);
      } else if (b.style === 'orb') {
        const p = Math.sin(state.frameCount * 0.2) * 5;
        ctx.beginPath(); ctx.arc(0, 0, b.radius + p, 0, Math.PI*2); ctx.fill();
        ctx.globalAlpha = 0.3; ctx.beginPath(); ctx.arc(0, 0, b.radius*2.2, 0, Math.PI*2); ctx.fill();
      } else {
        ctx.beginPath(); ctx.arc(0, 0, b.radius, 0, Math.PI*2); ctx.fill();
      }
      ctx.restore();
    });

    state.enemies.forEach(e => {
      const ex = e.x - cam.x, ey = e.y - cam.y;
      if (ex < -100 || ex > sw + 100 || ey < -100 || ey > sh + 100) return;
      ctx.save();
      ctx.translate(ex, ey);
      ctx.shadowBlur = 15; ctx.shadowColor = e.color;
      ctx.fillStyle = e.hitFlash ? '#fff' : e.color;
      
      const anim = Math.sin(state.frameCount * 0.1) * 2;
      
      if (e.type === 'skeleton') {
        ctx.beginPath(); ctx.arc(0, -e.radius/2 + anim, e.radius/1.4, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(-e.radius/3, -e.radius/2 + anim, 3, 0, Math.PI*2); ctx.arc(e.radius/3, -e.radius/2 + anim, 3, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = e.hitFlash ? '#fff' : e.color;
        for(let i=0; i<3; i++) ctx.fillRect(-e.radius/1.5, i*7 + anim, e.radius*1.3, 3);
      } else if (e.type === 'orc') {
        ctx.beginPath(); ctx.arc(0, anim, e.radius, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#1f2937'; ctx.fillRect(-e.radius, -e.radius/3 + anim, e.radius*2, 12);
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(-e.radius/2, 8+anim); ctx.lineTo(-e.radius/1.5, 18+anim); ctx.lineTo(-e.radius/4, 12+anim); ctx.fill();
        ctx.beginPath(); ctx.moveTo(e.radius/2, 8+anim); ctx.lineTo(e.radius/1.5, 18+anim); ctx.lineTo(e.radius/4, 12+anim); ctx.fill();
      } else if (e.type === 'vampire') {
        ctx.beginPath(); ctx.moveTo(-e.radius*1.2, -e.radius+anim); ctx.lineTo(0, e.radius*1.5+anim); ctx.lineTo(e.radius*1.2, -e.radius+anim); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#f3f4f6'; ctx.beginPath(); ctx.arc(0, -e.radius/1.5+anim, e.radius/1.8, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(-e.radius/5, -e.radius/1.5+anim, 2.5, 0, Math.PI*2); ctx.arc(e.radius/5, -e.radius/1.5+anim, 2.5, 0, Math.PI*2); ctx.fill();
      } else {
        const flap = Math.sin(state.frameCount * 0.4) * e.radius;
        ctx.beginPath(); ctx.moveTo(-e.radius - flap, -flap + anim); ctx.lineTo(0, anim); ctx.lineTo(e.radius + flap, -flap + anim); ctx.lineWidth = 4; ctx.strokeStyle = e.color; ctx.stroke();
        ctx.beginPath(); ctx.arc(0, anim, e.radius/1.2, 0, Math.PI*2); ctx.fill();
      }
      ctx.restore();
    });

    const px = state.playerPos.x - cam.x, py = state.playerPos.y - cam.y;
    ctx.save();
    ctx.translate(px, py);
    if (state.playerFacingLeft) ctx.scale(-1, 1);
    ctx.shadowBlur = 45; ctx.shadowColor = stats.color;
    if (skinImageRef.current) {
      ctx.drawImage(skinImageRef.current, -60, -60, 120, 120);
    } else {
      ctx.fillStyle = stats.color; ctx.beginPath(); ctx.arc(0, 0, 28, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-22,-10); ctx.lineTo(-32,-40); ctx.lineTo(-6,-22); ctx.fill();
      ctx.beginPath(); ctx.moveTo(22,-10); ctx.lineTo(32,-40); ctx.lineTo(6,-22); ctx.fill();
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(-10, -8, 6, 0, Math.PI*2); ctx.arc(10, -8, 6, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-8, -10, 2.5, 0, Math.PI*2); ctx.arc(12, -10, 2.5, 0, Math.PI*2); ctx.fill();
    }
    ctx.restore();
    ctx.restore();
  };

  return <canvas ref={canvasRef} className="block w-full h-full" onContextMenu={(e) => e.preventDefault()} />;
};

export default GameCanvas;
