import React from 'react';
import { UpgradeOption } from '../types';

interface LevelUpModalProps {
  options: UpgradeOption[];
  onSelect: (option: UpgradeOption) => void;
}

const LevelUpModal: React.FC<LevelUpModalProps> = ({ options, onSelect }) => {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-50 animate-in fade-in duration-300">
      <div className="max-w-4xl w-full p-8 text-center">
        <h2 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 mb-8 drop-shadow-[0_0_10px_rgba(255,200,0,0.5)]">
          SEVİYE ATLADIN!
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {options.map((option) => (
            <button
              key={option.id}
              onClick={() => onSelect(option)}
              className={`
                group relative overflow-hidden rounded-xl border-2 p-6 transition-all duration-300 hover:scale-105 active:scale-95
                flex flex-col items-center gap-4 text-left
                ${
                  option.rarity === 'legendary' 
                  ? 'border-purple-500 bg-purple-900/20 hover:bg-purple-900/40 hover:shadow-[0_0_30px_rgba(168,85,247,0.5)]' 
                  : option.rarity === 'rare'
                  ? 'border-blue-500 bg-blue-900/20 hover:bg-blue-900/40 hover:shadow-[0_0_30px_rgba(59,130,246,0.5)]'
                  : 'border-cyan-500 bg-cyan-900/20 hover:bg-cyan-900/40 hover:shadow-[0_0_30px_rgba(6,182,212,0.5)]'
                }
              `}
            >
              <div className="text-6xl mb-2 group-hover:animate-bounce">{option.icon}</div>
              
              <div className="w-full">
                <h3 className={`text-xl font-bold mb-2 ${
                  option.rarity === 'legendary' ? 'text-purple-400' :
                  option.rarity === 'rare' ? 'text-blue-400' : 'text-cyan-400'
                }`}>
                  {option.title}
                </h3>
                <p className="text-gray-300 text-sm leading-relaxed">
                  {option.description}
                </p>
              </div>

              {/* Rarity Badge */}
              <div className="absolute top-2 right-2 text-[10px] uppercase font-bold tracking-wider opacity-50">
                {option.rarity}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LevelUpModal;