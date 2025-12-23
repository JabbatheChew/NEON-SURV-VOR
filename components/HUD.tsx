
import React from 'react';
import { PlayerStats } from '../types';
import { CHARACTERS, UPGRADE_POOL } from '../constants';

interface HUDProps {
  stats: PlayerStats;
  isMuted: boolean;
  onToggleMute: () => void;
}

const HUD: React.FC<HUDProps> = ({ stats, isMuted, onToggleMute }) => {
  const hpPercent = Math.max(0, (stats.hp / stats.maxHp) * 100);
  const xpPercent = Math.min(100, (stats.xp / stats.xpToNextLevel) * 100);
  const manaPercent = Math.min(100, (stats.mana / stats.maxMana) * 100);
  const isManaFull = stats.mana >= stats.maxMana;
  
  const char = CHARACTERS.find(c => c.id === stats.characterId);

  return (
    <div className="absolute top-0 left-0 w-full p-6 pointer-events-none select-none z-10 flex flex-col gap-4">
      <div className="flex justify-between items-start">
        <div className="flex flex-col gap-3 w-80">
          {/* Status Bars */}
          <div className="flex flex-col gap-1">
            <div className="w-full bg-black/60 border-2 border-gray-800 h-7 rounded-lg overflow-hidden relative shadow-2xl">
              <div className="h-full bg-gradient-to-r from-red-600 to-red-400 transition-all duration-300" style={{ width: `${hpPercent}%` }}></div>
              <span className="absolute inset-0 flex items-center justify-center text-xs font-black text-white uppercase tracking-tighter drop-shadow-md">
                SAĞLIK {Math.ceil(stats.hp)} / {Math.ceil(stats.maxHp)}
              </span>
            </div>
            
            <div className="w-full bg-black/60 border-2 border-gray-800 h-5 rounded-lg overflow-hidden relative shadow-2xl">
              <div className={`h-full transition-all duration-300 ${isManaFull ? 'bg-cyan-400 animate-pulse' : 'bg-cyan-600'}`} style={{ width: `${manaPercent}%` }}></div>
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-white uppercase tracking-widest">
                MANA: {char?.specialName}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-yellow-400 font-black text-3xl italic tracking-tighter drop-shadow-lg">LVL {stats.level}</div>
            <div className="flex-1 bg-gray-900/50 h-2 rounded-full overflow-hidden border border-gray-800">
              <div className="h-full bg-yellow-400 transition-all" style={{ width: `${xpPercent}%` }}></div>
            </div>
          </div>

          {isManaFull && (
            <div className="bg-cyan-500/20 border-2 border-cyan-400 p-2 rounded-xl text-cyan-400 font-black text-center animate-bounce shadow-[0_0_20px_rgba(34,211,238,0.3)] text-sm">
              [SAĞ TIK / SPACE] ÖZEL YETENEK HAZIR!
            </div>
          )}
        </div>

        <div className="absolute left-1/2 -translate-x-1/2 top-6 bg-black/40 backdrop-blur-md px-10 py-2 rounded-full border border-white/10">
          <div className="text-white font-mono text-4xl font-black tracking-tighter">
            {Math.floor(stats.survivalTime / 60).toString().padStart(2, '0')}:{(stats.survivalTime % 60).toString().padStart(2, '0')}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="text-red-500 font-black text-4xl drop-shadow-2xl italic">💀 {stats.killCount}</div>
          <button onClick={onToggleMute} className="pointer-events-auto p-3 bg-gray-900/80 rounded-full border border-gray-700 hover:bg-gray-800 transition-colors">
            {isMuted ? '🔇' : '🔊'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default HUD;
