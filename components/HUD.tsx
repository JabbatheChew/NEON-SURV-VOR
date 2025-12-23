
import React from 'react';
import { PlayerStats } from '../types';
import { CHARACTERS } from '../constants';

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
    <div className="absolute top-0 left-0 w-full p-3 md:p-6 pointer-events-none select-none z-10 flex flex-col gap-2 md:gap-4">
      <div className="flex justify-between items-start">
        <div className="flex flex-col gap-2 w-48 md:w-80">
          <div className="w-full bg-black/60 border-2 border-gray-800 h-5 md:h-7 rounded-lg overflow-hidden relative shadow-2xl">
            <div className="h-full bg-gradient-to-r from-red-600 to-red-400 transition-all duration-300" style={{ width: `${hpPercent}%` }}></div>
            <span className="absolute inset-0 flex items-center justify-center text-[8px] md:text-[10px] font-black text-white uppercase tracking-tighter shadow-black drop-shadow-lg">
              {Math.ceil(stats.hp)} HP
            </span>
          </div>
          
          <div className="w-full bg-black/60 border border-gray-800 h-3 md:h-5 rounded-lg overflow-hidden relative">
            <div className={`h-full transition-all duration-300 ${isManaFull ? 'bg-cyan-400 animate-pulse shadow-[0_0_10px_cyan]' : 'bg-cyan-600'}`} style={{ width: `${manaPercent}%` }}></div>
            <span className="absolute inset-0 flex items-center justify-center text-[6px] md:text-[8px] font-black text-white uppercase tracking-widest">
              ULTI: {char?.specialName}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-yellow-400 font-black text-lg md:text-2xl italic tracking-tighter">LV {stats.level}</div>
            <div className="flex-1 bg-gray-900/50 h-1 md:h-2 rounded-full overflow-hidden border border-gray-800">
              <div className="h-full bg-yellow-400 transition-all" style={{ width: `${xpPercent}%` }}></div>
            </div>
          </div>
        </div>

        <div className="absolute left-1/2 -translate-x-1/2 top-3 md:top-6 bg-black/40 backdrop-blur-md px-4 md:px-10 py-1 md:py-2 rounded-full border border-white/10">
          <div className="text-white font-mono text-xl md:text-3xl font-black tracking-tighter">
            {Math.floor(stats.survivalTime / 60).toString().padStart(2, '0')}:{(stats.survivalTime % 60).toString().padStart(2, '0')}
          </div>
        </div>

        <div className="flex flex-col items-end gap-1 md:gap-2">
          <div className="text-red-500 font-black text-2xl md:text-4xl italic drop-shadow-xl">💀 {stats.killCount}</div>
          <button onClick={onToggleMute} className="pointer-events-auto p-1.5 md:p-3 bg-gray-900/80 rounded-full border border-gray-700 hover:bg-gray-800 transition-colors">
            {isMuted ? '🔇' : '🔊'}
          </button>
        </div>
      </div>
      
      {isManaFull && (
        <div className="self-center bg-cyan-500/20 border border-cyan-400 px-4 py-1.5 rounded-full text-cyan-400 font-black text-center animate-bounce shadow-lg text-[10px] md:text-xs">
          [SPACE / SAĞ TIK] HAZIR!
        </div>
      )}
    </div>
  );
};

export default HUD;
