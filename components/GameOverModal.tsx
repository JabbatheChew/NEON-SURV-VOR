import React from 'react';
import { PlayerStats } from '../types';

interface GameOverModalProps {
  stats: PlayerStats;
  onRestart: () => void;
}

const GameOverModal: React.FC<GameOverModalProps> = ({ stats, onRestart }) => {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-red-900/30 backdrop-blur-md z-50 animate-in zoom-in duration-500">
      <div className="bg-black/90 border-4 border-red-600 p-12 rounded-2xl text-center max-w-lg w-full shadow-[0_0_50px_rgba(220,38,38,0.5)]">
        <h1 className="text-6xl font-black text-red-600 mb-2 tracking-tighter">ÖLDÜN</h1>
        <p className="text-gray-400 mb-8 uppercase tracking-widest text-sm">Operasyon Başarısız</p>
        
        <div className="grid grid-cols-2 gap-4 mb-8 text-left bg-gray-900 p-6 rounded-lg border border-gray-800">
          <div>
            <p className="text-xs text-gray-500 uppercase">Ulaşılan Seviye</p>
            <p className="text-2xl font-mono text-white">{stats.level}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase">Toplam Leş</p>
            <p className="text-2xl font-mono text-red-400">{stats.killCount}</p>
          </div>
        </div>

        <button
          onClick={onRestart}
          className="w-full py-4 px-8 bg-red-600 hover:bg-red-500 text-white font-bold text-xl rounded transition-colors shadow-lg shadow-red-900/50"
        >
          YENİDEN BAŞLA
        </button>
      </div>
    </div>
  );
};

export default GameOverModal;