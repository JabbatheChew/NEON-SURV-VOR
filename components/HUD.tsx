
import React from 'react';
import { PlayerStats } from '../types';
import { CHARACTERS, UPGRADE_POOL } from '../constants';

interface HUDProps {
  stats: PlayerStats;
}

const HUD: React.FC<HUDProps> = ({ stats }) => {
  const hpPercent = Math.max(0, (stats.hp / stats.maxHp) * 100);
  const xpPercent = Math.min(100, (stats.xp / stats.xpToNextLevel) * 100);
  const manaPercent = Math.min(100, (stats.mana / stats.maxMana) * 100);
  const isManaFull = stats.mana >= stats.maxMana;
  
  const char = CHARACTERS.find(c => c.id === stats.characterId);

  return (
    <div className="absolute top-0 left-0 w-full p-4 pointer-events-none select-none z-10">
      <div className="flex justify-between items-start">
        
        <div className="flex flex-col gap-2 w-72">
          {/* HP Bar */}
          <div className="w-full bg-gray-900 border-2 border-gray-700 h-6 rounded overflow-hidden relative">
            <div className="h-full bg-red-600 transition-all duration-200" style={{ width: `${hpPercent}%` }}></div>
            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white shadow-black drop-shadow-md">
              HP {Math.ceil(stats.hp)} / {Math.ceil(stats.maxHp)}
            </span>
          </div>

          {/* Mana Bar */}
          <div className="w-full bg-gray-900 border-2 border-gray-700 h-4 rounded overflow-hidden relative shadow-[0_0_10px_rgba(0,0,0,0.5)]">
            <div className={`h-full transition-all duration-200 ${isManaFull ? 'bg-blue-400 animate-pulse' : 'bg-blue-600'}`} style={{ width: `${manaPercent}%` }}></div>
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white">
              MANA ({char?.specialName})
            </span>
          </div>
          
          {isManaFull && (
            <div className="text-blue-300 font-bold text-sm animate-bounce tracking-widest text-center border border-blue-500 bg-blue-900/50 rounded py-1">
              [SPACE] HAZIR!
            </div>
          )}

          {/* XP Bar */}
          <div className="w-full bg-gray-900 border-2 border-gray-700 h-2 rounded overflow-hidden relative mt-1 opacity-80">
            <div className="h-full bg-yellow-400 transition-all duration-200" style={{ width: `${xpPercent}%` }}></div>
          </div>
          
          <div className="text-cyan-400 font-mono text-xl font-bold shadow-black drop-shadow-lg mt-1">
            LVL {stats.level}
          </div>

          {/* ARSENAL LIST */}
          <div className="mt-4 flex gap-2">
            {stats.weapons.map((wpnId, idx) => {
              const upgrade = UPGRADE_POOL.find(u => u.value === wpnId);
              return (
                <div key={idx} className="w-10 h-10 bg-gray-900/80 border border-gray-700 rounded-lg flex items-center justify-center text-xl shadow-lg" title={wpnId}>
                  {upgrade?.icon || '⚔️'}
                </div>
              );
            })}
          </div>
        </div>

        <div className="text-right">
          <div className="text-red-500 font-mono text-2xl font-bold drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">
            💀 {stats.killCount}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HUD;
