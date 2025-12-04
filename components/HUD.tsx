import React from 'react';
import { PlayerStats } from '../types';

interface HUDProps {
  stats: PlayerStats;
}

const HUD: React.FC<HUDProps> = ({ stats }) => {
  const hpPercent = Math.max(0, (stats.hp / stats.maxHp) * 100);
  const xpPercent = Math.min(100, (stats.xp / stats.xpToNextLevel) * 100);

  return (
    <div className="absolute top-0 left-0 w-full p-4 pointer-events-none select-none z-10">
      <div className="flex justify-between items-start">
        
        {/* Left: HP & Level */}
        <div className="flex flex-col gap-2 w-64">
          {/* HP Bar */}
          <div className="w-full bg-gray-900 border-2 border-gray-700 h-6 rounded overflow-hidden relative">
            <div 
              className="h-full bg-red-600 transition-all duration-200" 
              style={{ width: `${hpPercent}%` }}
            ></div>
            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white shadow-black drop-shadow-md">
              HP {Math.ceil(stats.hp)} / {Math.ceil(stats.maxHp)}
            </span>
          </div>

          {/* XP Bar */}
          <div className="w-full bg-gray-900 border-2 border-gray-700 h-4 rounded overflow-hidden relative mt-1">
            <div 
              className="h-full bg-yellow-400 transition-all duration-200" 
              style={{ width: `${xpPercent}%` }}
            ></div>
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-black">
              XP {Math.floor(stats.xp)} / {Math.floor(stats.xpToNextLevel)}
            </span>
          </div>
          
          <div className="text-cyan-400 font-mono text-xl font-bold shadow-black drop-shadow-lg">
            LVL {stats.level}
          </div>
        </div>

        {/* Right: Kills */}
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