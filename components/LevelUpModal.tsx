
import React from 'react';
import { UpgradeOption } from '../types';

interface LevelUpModalProps {
  options: UpgradeOption[];
  onSelect: (option: UpgradeOption) => void;
}

const LevelUpModal: React.FC<LevelUpModalProps> = ({ options, onSelect }) => {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/90 backdrop-blur-2xl z-[500] p-4">
      <div className="max-w-3xl w-full flex flex-col items-center">
        <h2 className="text-3xl md:text-5xl font-black text-center text-cyan-400 mb-8 italic uppercase tracking-tighter drop-shadow-[0_0_20px_rgba(34,211,238,0.4)]">
          GÜÇLENDİRME SEÇ
        </h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
          {options.length > 0 ? options.map((option) => (
            <button
              key={option.id}
              onClick={() => onSelect(option)}
              className={`group relative overflow-hidden rounded-xl border-2 p-4 transition-all hover:scale-[1.03] active:scale-95 flex flex-col items-center gap-2 text-center pointer-events-auto
                ${option.rarity === 'legendary' ? 'border-purple-500 bg-purple-900/30 shadow-[0_0_30px_rgba(168,85,247,0.3)]' : 
                  option.rarity === 'rare' ? 'border-blue-500 bg-blue-900/30 shadow-[0_0_20px_rgba(59,130,246,0.2)]' : 'border-gray-700 bg-gray-800/40'}`}
            >
              <div className="text-4xl md:text-6xl mb-1 drop-shadow-lg group-hover:scale-110 transition-transform">{option.icon}</div>
              <div className="flex flex-col gap-0.5">
                <h3 className="text-sm md:text-lg font-black text-white uppercase tracking-tight">{option.title}</h3>
                <p className="text-[8px] md:text-[10px] text-gray-400 font-medium leading-tight">{option.description}</p>
              </div>
              
              <div className={`mt-auto px-2 py-0.5 rounded-full text-[7px] font-black uppercase tracking-widest
                ${option.rarity === 'legendary' ? 'bg-purple-600 text-white' : 
                  option.rarity === 'rare' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`}>
                {option.rarity}
              </div>
            </button>
          )) : (
            <div className="col-span-full text-white text-center opacity-50">Seçenekler yükleniyor...</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LevelUpModal;
