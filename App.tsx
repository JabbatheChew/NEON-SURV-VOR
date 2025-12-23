
import React, { useState, useCallback, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import GameCanvas from './components/GameCanvas';
import HUD from './components/HUD';
import LevelUpModal from './components/LevelUpModal';
import GameOverModal from './components/GameOverModal';
import { GameStatus, PlayerStats, UpgradeOption } from './types';
import { INITIAL_PLAYER_STATS, UPGRADE_POOL, CHARACTERS } from './constants';
import { playSound, toggleMute } from './utils/SoundManager';

const App: React.FC = () => {
  const [status, setStatus] = useState<GameStatus>(GameStatus.MENU);
  const [playerStats, setPlayerStats] = useState<PlayerStats>({ ...INITIAL_PLAYER_STATS });
  const [upgradeOptions, setUpgradeOptions] = useState<UpgradeOption[]>([]);
  const [gameId, setGameId] = useState(0);
  const [selectedCharId, setSelectedCharId] = useState<string>('default');
  const [customSkins, setCustomSkins] = useState<Record<string, string>>({});
  const [isMuted, setIsMuted] = useState(false);
  
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiGenerating, setIsAiGenerating] = useState(false);

  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        if (status === GameStatus.PLAYING) setStatus(GameStatus.PAUSED_MANUAL);
        else if (status === GameStatus.PAUSED_MANUAL) setStatus(GameStatus.PLAYING);
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, [status]);

  const handleToggleMute = () => {
    setIsMuted(toggleMute());
  };

  const startGame = () => {
    const char = CHARACTERS.find(c => c.id === selectedCharId) || CHARACTERS[0];
    setPlayerStats({ 
      ...INITIAL_PLAYER_STATS, 
      ...char.baseStats, 
      color: char.color, 
      characterId: char.id, 
      weapons: char.baseStats.weapons || ['claw'],
      customSkinUrl: customSkins[char.id],
      xp: 0,
      level: 1,
      xpToNextLevel: 100,
      fireRate: 60, 
      mana: 0,
    });
    setGameId(prev => prev + 1);
    setStatus(GameStatus.PLAYING);
    playSound('start');
  };

  const generateAiSkin = async () => {
    if (!aiPrompt) return;
    setIsAiGenerating(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: `A circular top-down futuristic cyberpunk game character sprite for "${aiPrompt}". Symmetrical, vibrant colors, neon glows, flat black background, high quality digital art.` }] }
      });

      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          const skinUrl = `data:image/png;base64,${part.inlineData.data}`;
          setCustomSkins(prev => ({ ...prev, [selectedCharId]: skinUrl }));
          break;
        }
      }
      setIsAiModalOpen(false);
    } catch (e) {
      console.error(e);
      alert("AI üretimi başarısız oldu.");
    } finally {
      setIsAiGenerating(false);
    }
  };

  const handleLevelUp = useCallback(() => {
    const pool = [...UPGRADE_POOL];
    const selected: UpgradeOption[] = [];
    while (selected.length < 3 && pool.length > 0) {
      const idx = Math.floor(Math.random() * pool.length);
      selected.push(pool.splice(idx, 1)[0]);
    }
    setUpgradeOptions(selected);
    setStatus(GameStatus.LEVEL_UP);
    playSound('levelup');
  }, []);

  const handleApplyUpgrade = useCallback((option: UpgradeOption) => {
    setPlayerStats(prev => {
      const next = { ...prev };
      next.level += 1;
      next.xp = 0;
      next.xpToNextLevel = Math.floor(prev.xpToNextLevel * 1.4);

      const val = typeof option.value === 'number' ? option.value : 0;
      switch (option.type) {
        case 'damage': next.damage *= (1 + val); break;
        case 'speed': next.speed += val; break;
        case 'fireRate': next.fireRate = Math.max(15, Math.floor(next.fireRate * (1 - val))); break;
        case 'bulletSpeed': next.bulletSpeed += val; break;
        case 'heal': next.hp = Math.min(next.maxHp, next.hp + val); break;
        case 'multishot': next.projectileCount += val; break;
        case 'weapon': 
          if (typeof option.value === 'string' && !next.weapons.includes(option.value)) {
            next.weapons = [...next.weapons, option.value];
          }
          break;
      }
      return next;
    });
    setStatus(GameStatus.PLAYING);
    playSound('upgrade');
  }, []);

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden font-sans text-white" onContextMenu={(e) => e.preventDefault()}>
      {status === GameStatus.MENU && (
        <div className="absolute inset-0 z-20 bg-[#050510] flex flex-col items-center">
          <div className="w-full max-w-5xl flex flex-col items-center py-6 px-6 h-full">
            <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-white to-blue-600 mb-4 drop-shadow-2xl text-center italic tracking-tighter uppercase">NEON SURVIVOR</h1>
            
            <div className="flex-1 overflow-y-auto w-full mb-6 grid grid-cols-2 md:grid-cols-3 gap-4 p-4 custom-scrollbar">
              {CHARACTERS.map(char => (
                <button key={char.id} onClick={() => setSelectedCharId(char.id)}
                  className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 group ${selectedCharId === char.id ? 'border-cyan-400 bg-cyan-950/40 scale-105 shadow-[0_0_30px_rgba(6,182,212,0.4)]' : 'border-gray-800 bg-gray-900/40 hover:border-gray-600'}`}>
                  {customSkins[char.id] ? (
                    <img src={customSkins[char.id]} className="w-20 h-20 object-contain rounded-full border border-white/10" alt="skin" />
                  ) : (
                    <div className="text-5xl group-hover:scale-125 transition-transform">{char.icon}</div>
                  )}
                  <div className="font-bold text-lg">{char.name}</div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-widest">{char.unlockCondition}</div>
                </button>
              ))}
            </div>

            <div className="w-full flex flex-col sm:flex-row gap-4 justify-center items-center pb-8">
              <button onClick={() => setIsAiModalOpen(true)} className="px-8 py-4 bg-purple-700 hover:bg-purple-600 font-bold text-lg rounded-2xl shadow-xl transition-all border-b-4 border-purple-900">
                AI KOSTÜM ✨
              </button>
              <button onClick={startGame} className="px-20 py-5 bg-cyan-600 hover:bg-cyan-500 font-black text-4xl rounded-2xl shadow-[0_0_40px_rgba(6,182,212,0.4)] transition-all border-b-4 border-cyan-800">
                BAŞLAT
              </button>
            </div>
          </div>
        </div>
      )}

      {isAiModalOpen && (
        <div className="absolute inset-0 z-[100] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-6">
          <div className="bg-gray-900 border-2 border-purple-500 p-8 rounded-[40px] max-w-md w-full shadow-[0_0_100px_rgba(168,85,247,0.3)]">
            <h2 className="text-3xl font-black mb-2 text-purple-400 uppercase italic">KOSTÜM ÜRETİCİ</h2>
            <p className="text-gray-500 text-sm mb-6">Karakterin için benzersiz bir top-down görünüm tasarla.</p>
            <textarea 
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="Örn: Mavi alevli robot kedi, siber şövalye..."
              className="w-full h-32 bg-black border border-gray-700 rounded-2xl p-4 text-white mb-6 focus:border-purple-500 outline-none resize-none"
            />
            <div className="flex gap-4">
              <button onClick={() => setIsAiModalOpen(false)} className="flex-1 py-4 font-bold text-gray-400 hover:text-white">İPTAL</button>
              <button onClick={generateAiSkin} disabled={isAiGenerating} className="flex-[2] py-4 bg-purple-600 hover:bg-purple-500 rounded-2xl font-black shadow-lg disabled:opacity-50">
                {isAiGenerating ? 'ANALİZ EDİLİYOR...' : 'KOSTÜMÜ BAS ✨'}
              </button>
            </div>
          </div>
        </div>
      )}

      {(status !== GameStatus.MENU) && (
        <>
          <GameCanvas 
            key={gameId} 
            status={status}
            playerStats={playerStats}
            onUpdateStats={(s) => setPlayerStats(prev => ({...prev, ...s}))}
            onLevelUp={handleLevelUp}
            onGameOver={() => { setStatus(GameStatus.GAME_OVER); playSound('gameover'); }}
          />
          <HUD stats={playerStats} isMuted={isMuted} onToggleMute={handleToggleMute} />
        </>
      )}

      {status === GameStatus.PAUSED_MANUAL && (
        <div className="absolute inset-0 z-[200] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center">
          <h2 className="text-8xl font-black text-cyan-400 mb-8 italic drop-shadow-[0_0_30px_rgba(34,211,238,0.5)]">DURDU</h2>
          <button onClick={() => setStatus(GameStatus.PLAYING)} className="px-16 py-6 bg-cyan-600 hover:bg-cyan-500 font-bold text-3xl rounded-3xl shadow-2xl transition-all hover:scale-110">DEVAM ET</button>
          <button onClick={() => setStatus(GameStatus.MENU)} className="mt-12 text-gray-500 hover:text-white uppercase tracking-widest font-bold">ANA MENÜ</button>
        </div>
      )}

      {status === GameStatus.LEVEL_UP && <LevelUpModal options={upgradeOptions} onSelect={handleApplyUpgrade} />}
      {status === GameStatus.GAME_OVER && <GameOverModal stats={playerStats} onRestart={startGame} />}
    </div>
  );
};

export default App;
