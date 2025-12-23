
import React, { useState } from 'react';
import { UpgradeOption } from '../types';
import { GoogleGenAI } from "@google/genai";

interface LevelUpModalProps {
  options: UpgradeOption[];
  onSelect: (option: UpgradeOption) => void;
}

const LevelUpModal: React.FC<LevelUpModalProps> = ({ options, onSelect }) => {
  const [aiIcons, setAiIcons] = useState<Record<string, string>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const enhanceIcon = async (id: string, title: string, desc: string) => {
    setLoadingId(id);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: `Epic game skill icon for "${title}" (${desc}). Cyberpunk neon style, cinematic lighting, 8k resolution, black background, glowing particles, futuristic aesthetic, centralized composition.` }] }
      });

      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          setAiIcons(prev => ({ ...prev, [id]: `data:image/png;base64,${part.inlineData.data}` }));
          break;
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/95 backdrop-blur-2xl z-[200]">
      <div className="max-w-6xl w-full p-12">
        <h2 className="text-8xl font-black text-center text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-white to-cyan-400 mb-16 italic tracking-tighter drop-shadow-2xl">
          SİSTEM GÜNCELLENİYOR
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {options.map((option) => (
            <div key={option.id} className="group flex flex-col gap-4">
              <button
                onClick={() => onSelect(option)}
                className={`relative overflow-hidden rounded-[40px] border-4 p-10 transition-all hover:scale-110 active:scale-95 flex flex-col items-center gap-8 shadow-2xl
                  ${option.rarity === 'legendary' ? 'border-purple-500 bg-purple-900/30' : 'border-cyan-500 bg-cyan-900/30'}`}
              >
                <div className="w-32 h-32 rounded-3xl bg-black/60 border-2 border-white/10 overflow-hidden flex items-center justify-center shadow-inner">
                  {aiIcons[option.id] ? (
                    <img src={aiIcons[option.id]} className="w-full h-full object-cover animate-in fade-in duration-700" />
                  ) : (
                    <span className="text-8xl">{option.icon}</span>
                  )}
                </div>
                
                <div className="text-center">
                  <h3 className="text-3xl font-black text-white mb-3 tracking-tight">{option.title}</h3>
                  <p className="text-cyan-200/60 font-medium leading-tight">{option.description}</p>
                </div>
                
                {option.rarity === 'legendary' && (
                  <div className="absolute top-4 right-4 animate-bounce text-yellow-400 font-bold text-xs bg-yellow-900/50 px-3 py-1 rounded-full border border-yellow-500">
                    EFSANEVİ
                  </div>
                )}
              </button>
              
              <button 
                disabled={loadingId === option.id}
                onClick={() => enhanceIcon(option.id, option.title, option.description)}
                className="text-xs text-purple-400 uppercase font-black tracking-[0.2em] hover:text-white transition-all bg-purple-950/20 py-2 rounded-xl border border-purple-900/30">
                {loadingId === option.id ? 'VERİ İŞLENİYOR...' : 'GENETİK MODİFİKASYON (AI) ✨'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LevelUpModal;
