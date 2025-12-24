
import React, { useState, useCallback, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import GameCanvas from './components/GameCanvas';
import HUD from './components/HUD';
import LevelUpModal from './components/LevelUpModal';
import GameOverModal from './components/GameOverModal';
import { GameStatus, PlayerStats, UpgradeOption, Character, MapType } from './types';
import { INITIAL_PLAYER_STATS, UPGRADE_POOL, CHARACTERS as STATIC_CHARACTERS, MAP_CONFIGS } from './constants';
import { playSound, toggleMute } from './utils/SoundManager';

const App: React.FC = () => {
  const [status, setStatus] = useState<GameStatus>(GameStatus.MENU);
  const [playerStats, setPlayerStats] = useState<PlayerStats>({ ...INITIAL_PLAYER_STATS });
  const [upgradeOptions, setUpgradeOptions] = useState<UpgradeOption[]>([]);
  const [gameId, setGameId] = useState(0);
  const [characters, setCharacters] = useState<Character[]>([...STATIC_CHARACTERS]);
  const [selectedCharId, setSelectedCharId] = useState<string>('default');
  const [selectedMapId, setSelectedMapId] = useState<MapType>('forest');
  const [customSkins, setCustomSkins] = useState<Record<string, string>>({});
  const [isMuted, setIsMuted] = useState(false);
  
  // AI States
  const [studioTab, setStudioTab] = useState<'flash' | 'pro' | 'veo'>('flash');
  const [aiPrompt, setAiPrompt] = useState('A neon cyberpunk warrior cat, top-down game sprite');
  const [aiSize, setAiSize] = useState<'1K' | '2K' | '4K'>('1K');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [veoVideoUrl, setVeoVideoUrl] = useState<string | null>(null);
  const [lastGeneratedUrl, setLastGeneratedUrl] = useState<string | null>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { 
      if (e.code === 'Escape') {
        if (status === GameStatus.PLAYING) setStatus(GameStatus.PAUSED_MANUAL);
        else if (status === GameStatus.PAUSED_MANUAL) setStatus(GameStatus.PLAYING);
        else if (status === GameStatus.STUDIO) setStatus(GameStatus.MENU);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [status]);

  const handleLevelUp = useCallback(() => {
    const availableUpgrades = UPGRADE_POOL.filter(upgrade => {
      if (upgrade.type === 'weapon') {
        return !playerStats.weapons.includes(upgrade.value as string);
      }
      return true;
    });

    const shuffled = [...availableUpgrades].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 3);
    
    setUpgradeOptions(selected);
    setStatus(GameStatus.LEVEL_UP);
    playSound('levelup');
  }, [playerStats.weapons]);

  const handleAiError = async (e: any) => {
    console.error(e);
    if (e.message?.includes("not found") || e.message?.includes("key")) {
      await window.aistudio.openSelectKey();
    } else {
      alert("AI Hatası: " + e.message);
    }
  };

  const generateFlashImage = async () => {
    if (!aiPrompt) return;
    setIsAiLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ text: `High-quality top-down 2D game sprite of: ${aiPrompt}. Isolated on black, vibrant neon colors.` }] }
      });
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          const url = `data:image/png;base64,${part.inlineData.data}`;
          setLastGeneratedUrl(url);
          setCustomSkins(prev => ({ ...prev, [selectedCharId]: url }));
          break;
        }
      }
    } catch (e) { await handleAiError(e); } finally { setIsAiLoading(false); }
  };

  const generateProOrVeo = async () => {
    setIsAiLoading(true);
    try {
      if (!(await window.aistudio.hasSelectedApiKey())) {
        await window.aistudio.openSelectKey();
      }
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      if (studioTab === 'pro') {
        const response = await ai.models.generateContent({
          model: 'gemini-3-pro-image-preview',
          contents: { parts: [{ text: `Professional 4K game asset, top-down view: ${aiPrompt}. Black background, cinematic lighting.` }] },
          config: { imageConfig: { imageSize: aiSize, aspectRatio: "1:1" } }
        });
        const part = response.candidates[0].content.parts.find(p => p.inlineData);
        if (part?.inlineData) {
          const url = `data:image/png;base64,${part.inlineData.data}`;
          setLastGeneratedUrl(url);
          setCustomSkins(prev => ({ ...prev, [selectedCharId]: url }));
        }
      } else {
        const skin = lastGeneratedUrl || customSkins[selectedCharId];
        if (!skin) throw new Error("Önce bir görsel üretmelisin!");
        let op = await ai.models.generateVideos({
          model: 'veo-3.1-fast-generate-preview',
          prompt: `Cinematic neon animation of: ${aiPrompt}`,
          image: { imageBytes: skin.split(',')[1], mimeType: 'image/png' },
          config: { numberOfVideos: 1, resolution: '720p', aspectRatio: '16:9' }
        });
        while (!op.done) { 
          await new Promise(r => setTimeout(r, 8000)); 
          op = await ai.operations.getVideosOperation({operation: op}); 
        }
        setVeoVideoUrl(`${op.response?.generatedVideos?.[0]?.video?.uri}&key=${process.env.API_KEY}`);
      }
    } catch (e) { await handleAiError(e); } finally { setIsAiLoading(false); }
  };

  const saveAsNewCharacter = () => {
    if (!lastGeneratedUrl) return;
    const newId = `custom_${Date.now()}`;
    const newChar: Character = {
      id: newId,
      name: "AI Hero " + (characters.length - 3),
      description: aiPrompt,
      unlockCondition: 'ÜRETİLDİ',
      isUnlocked: () => true,
      baseStats: { speed: 5.5, damage: 30, hp: 130 },
      color: '#c026d3',
      icon: '✨',
      specialName: 'QUANTUM BURST',
      specialDescription: 'Zamanı yavaşlatır ve alanı temizler.'
    };
    setCharacters(prev => [...prev, newChar]);
    setCustomSkins(prev => ({ ...prev, [newId]: lastGeneratedUrl }));
    setSelectedCharId(newId);
    alert("Karakter listene eklendi!");
  };

  const startGame = () => {
    const char = characters.find(c => c.id === selectedCharId)!;
    setPlayerStats({ 
      ...INITIAL_PLAYER_STATS, 
      ...char.baseStats, 
      characterId: char.id, 
      color: char.color, 
      customSkinUrl: customSkins[char.id],
      selectedMap: selectedMapId
    });
    setGameId(g => g + 1); setStatus(GameStatus.PLAYING); playSound('start');
  };

  const selectedChar = characters.find(c => c.id === selectedCharId);

  // Stats for preview
  const charStats = {
    hp: selectedChar?.baseStats.hp || INITIAL_PLAYER_STATS.hp,
    speed: selectedChar?.baseStats.speed || INITIAL_PLAYER_STATS.speed,
    damage: selectedChar?.baseStats.damage || INITIAL_PLAYER_STATS.damage
  };

  const isGameActive = status === GameStatus.PLAYING || status === GameStatus.LEVEL_UP || status === GameStatus.PAUSED_MANUAL;

  return (
    <div className="relative w-full h-screen bg-[#050508] text-white font-sans overflow-hidden">
      {status === GameStatus.MENU && (
        <div className="absolute inset-0 bg-[#050510] flex flex-col items-center py-6 px-4 overflow-y-auto z-50">
          <h1 className="text-4xl md:text-6xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-white to-blue-600 mb-8 uppercase drop-shadow-2xl text-center">NEON SURVIVOR</h1>
          
          <div className="flex-1 w-full max-w-6xl flex flex-col lg:flex-row gap-8 items-center justify-center">
            {/* Left Column: Character and Map Lists */}
            <div className="flex flex-col gap-6 w-full lg:w-3/5">
              <div className="bg-gray-900/30 p-5 rounded-3xl border border-gray-800 backdrop-blur-md">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest ml-2">Karakterini Seç</h3>
                  <span className="text-[10px] font-bold text-cyan-500 bg-cyan-950/40 px-3 py-1 rounded-full border border-cyan-900/50 uppercase">Kapasite: {characters.length} Birim</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {characters.map(char => (
                    <button key={char.id} onClick={() => { setSelectedCharId(char.id); playSound('xp'); }}
                      className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-2 relative group ${selectedCharId === char.id ? 'border-cyan-400 bg-cyan-950/20 scale-105 shadow-[0_0_20px_rgba(34,211,238,0.2)]' : 'border-gray-800 bg-gray-900/30 hover:border-gray-700'}`}>
                      <div className="w-14 h-14 md:w-16 md:h-16 flex items-center justify-center">
                        {customSkins[char.id] ? (
                          <img src={customSkins[char.id]} className="w-full h-full object-contain rounded-full shadow-inner" />
                        ) : (
                          <div className="text-3xl md:text-4xl group-hover:scale-110 transition-transform">{char.icon}</div>
                        )}
                      </div>
                      <div className={`font-black text-[10px] text-center line-clamp-1 uppercase tracking-tighter ${selectedCharId === char.id ? 'text-cyan-400' : 'text-gray-500'}`}>{char.name}</div>
                      {char.id.startsWith('custom_') && <div className="absolute top-1 right-1 text-[6px] font-black bg-purple-600 px-1 py-0.5 rounded uppercase shadow-sm">AI</div>}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-gray-900/30 p-5 rounded-3xl border border-gray-800 backdrop-blur-md">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4 ml-2">Bölge Seç</h3>
                <div className="grid grid-cols-3 gap-3">
                  {(Object.values(MAP_CONFIGS)).map(map => (
                    <button key={map.id} onClick={() => { setSelectedMapId(map.id); playSound('xp'); }}
                      className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 relative group overflow-hidden ${selectedMapId === map.id ? 'border-orange-500 bg-orange-950/20 scale-105 shadow-[0_0_20px_rgba(249,115,22,0.2)]' : 'border-gray-800 bg-gray-900/30 hover:border-gray-700'}`}>
                      <div className="text-3xl mb-1 group-hover:scale-125 transition-transform z-10">{map.icon}</div>
                      <div className={`font-black text-[10px] uppercase tracking-tighter z-10 ${selectedMapId === map.id ? 'text-orange-400' : 'text-gray-500'}`}>{map.name}</div>
                      <div className={`absolute inset-0 bg-gradient-to-t opacity-10 pointer-events-none`} style={{ backgroundColor: map.accentColor }}></div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column: Character Details and Stats Preview */}
            <div className="w-full lg:w-2/5 perspective-container">
              <div className="char-3d-card bg-black/40 border border-cyan-400/20 rounded-3xl p-8 flex flex-col items-center justify-between relative shadow-[0_0_80px_rgba(0,0,0,0.5)] h-[550px] backdrop-blur-md">
                <div className="absolute inset-0 hologram-grid opacity-10 rounded-3xl"></div>
                
                {/* Character Icon/Skin Floating */}
                <div className="floating-anim relative z-10 flex flex-col items-center justify-center flex-1">
                   {customSkins[selectedCharId] ? (
                     <img src={customSkins[selectedCharId]} className="w-56 h-56 object-contain drop-shadow-[0_0_35px_rgba(0,243,255,0.7)]" />
                   ) : (
                     <div className="text-[120px] drop-shadow-[0_0_40px_rgba(255,255,255,0.3)] select-none">{selectedChar?.icon}</div>
                   )}
                </div>

                {/* Character Name and Special Ability */}
                <div className="w-full text-center relative z-10 mb-6">
                   <h3 className="text-4xl font-black text-cyan-400 uppercase tracking-tighter italic drop-shadow-sm">{selectedChar?.name}</h3>
                   <div className="flex items-center justify-center gap-2 mt-2">
                     <span className="h-[1px] w-8 bg-cyan-900"></span>
                     <p className="text-[10px] text-cyan-500 font-black uppercase tracking-[0.2em]">{selectedChar?.specialName}</p>
                     <span className="h-[1px] w-8 bg-cyan-900"></span>
                   </div>
                   <p className="text-[11px] text-gray-500 mt-3 px-6 leading-relaxed italic opacity-80">"{selectedChar?.description}"</p>
                </div>

                {/* Stats Section */}
                <div className="w-full bg-gray-950/50 p-6 rounded-2xl border border-gray-800/50 z-10">
                   <div className="space-y-4">
                      {/* HP Bar */}
                      <div>
                        <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1">
                          <span>Dayanıklılık (HP)</span>
                          <span className="text-red-500">{charStats.hp}</span>
                        </div>
                        <div className="h-1.5 bg-gray-900 rounded-full overflow-hidden border border-gray-800">
                          <div className="h-full bg-red-600 shadow-[0_0_8px_rgba(220,38,38,0.5)] transition-all duration-500" style={{ width: `${(charStats.hp / 250) * 100}%` }}></div>
                        </div>
                      </div>
                      {/* Speed Bar */}
                      <div>
                        <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1">
                          <span>Çeviklik (Hız)</span>
                          <span className="text-emerald-500">{charStats.speed.toFixed(1)}</span>
                        </div>
                        <div className="h-1.5 bg-gray-900 rounded-full overflow-hidden border border-gray-800">
                          <div className="h-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] transition-all duration-500" style={{ width: `${(charStats.speed / 7) * 100}%` }}></div>
                        </div>
                      </div>
                      {/* Damage Bar */}
                      <div>
                        <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-gray-500 mb-1">
                          <span>Vuruş Gücü (ATK)</span>
                          <span className="text-orange-500">{charStats.damage}</span>
                        </div>
                        <div className="h-1.5 bg-gray-900 rounded-full overflow-hidden border border-gray-800">
                          <div className="h-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)] transition-all duration-500" style={{ width: `${(charStats.damage / 40) * 100}%` }}></div>
                        </div>
                      </div>
                   </div>
                </div>

                <div className="absolute bottom-16 w-32 h-10 bg-cyan-400/20 blur-2xl rounded-full pointer-events-none"></div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-8 flex flex-col sm:flex-row gap-4 w-full max-w-lg pb-10 px-4">
            <button onClick={() => { setStatus(GameStatus.STUDIO); playSound('xp'); }} 
              className="flex-1 py-4 bg-purple-700 hover:bg-purple-600 font-bold text-base rounded-2xl border-b-4 border-purple-900 transition-all shadow-[0_10px_30px_rgba(126,34,206,0.3)] uppercase italic tracking-wider">
              AI STUDIO ✨
            </button>
            <button onClick={startGame} 
              className="flex-[2] py-4 px-12 bg-orange-600 hover:bg-orange-500 font-black text-2xl rounded-2xl border-b-4 border-orange-800 transition-all active:translate-y-1 shadow-[0_15px_40px_rgba(249,115,22,0.4)] uppercase italic tracking-tighter group">
              SİMÜLASYONU BAŞLAT
              <span className="block text-[10px] font-bold opacity-70 tracking-[0.3em] mt-0.5 group-hover:translate-x-1 transition-transform">INITIALIZING...</span>
            </button>
          </div>
        </div>
      )}

      {status === GameStatus.STUDIO && (
        <div className="absolute inset-0 z-[60] bg-[#0a0a15] flex flex-col items-center p-4 md:p-8 backdrop-blur-3xl overflow-y-auto">
          <div className="max-w-4xl w-full flex flex-col h-full">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-black text-purple-400 tracking-tighter uppercase italic">AI NEON STUDIO</h2>
              <button onClick={() => setStatus(GameStatus.MENU)} className="bg-gray-800 px-4 py-1.5 rounded-full font-bold uppercase text-[10px] hover:bg-white hover:text-black">Geri</button>
            </div>

            <div className="flex gap-1 mb-4 bg-gray-900/50 p-1 rounded-xl border border-gray-800">
              {(['flash', 'pro', 'veo'] as const).map(tab => (
                <button key={tab} onClick={() => { setStudioTab(tab); setVeoVideoUrl(null); }} 
                  className={`flex-1 py-2 font-bold rounded-lg transition-all text-[10px] uppercase tracking-widest ${studioTab === tab ? 'bg-purple-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
                  {tab === 'flash' ? 'Hızlı Üret (Ücretsiz)' : tab === 'pro' ? 'Pro 4K (Ücretli)' : 'Video (Ücretli)'}
                </button>
              ))}
            </div>

            <div className="flex-1 bg-black/40 border border-gray-800 rounded-2xl p-4 md:p-6 flex flex-col gap-6">
              {studioTab !== 'flash' && (
                <div className="bg-yellow-900/20 border border-yellow-700/30 p-2.5 rounded-lg text-[9px] text-yellow-500 font-medium">
                  ⚠️ <b>Not:</b> Pro ve Video modelleri Google politikası gereği <b>Ücretli GCP Projesi</b> gerektirir. 
                  <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="underline ml-1">Detaylar</a>
                </div>
              )}

              <div className="flex flex-col md:flex-row gap-6">
                <div className="w-full md:w-56 flex flex-col gap-2">
                  <div className="aspect-square bg-gray-900 rounded-xl border border-gray-800 flex items-center justify-center overflow-hidden relative shadow-2xl perspective-container">
                    {(lastGeneratedUrl || customSkins[selectedCharId]) ? (
                      <img src={lastGeneratedUrl || customSkins[selectedCharId]} className="w-full h-full object-contain p-2 floating-anim" />
                    ) : (
                      <div className="text-4xl opacity-10">🎨</div>
                    )}
                    {isAiLoading && <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-2">
                      <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-[8px] uppercase animate-pulse">Üretiliyor...</span>
                    </div>}
                  </div>
                  {lastGeneratedUrl && (
                    <button onClick={saveAsNewCharacter} className="w-full py-2 bg-cyan-700 hover:bg-cyan-600 rounded-lg font-bold uppercase text-[9px]">Koleksiyona Ekle 💾</button>
                  )}
                </div>

                <div className="flex-1 flex flex-col gap-4">
                  <textarea 
                    value={aiPrompt} 
                    onChange={e => setAiPrompt(e.target.value)} 
                    placeholder="Karakterini tarif et... (Örn: Ateş gözlü robot kaplan)" 
                    className="w-full h-24 bg-gray-900/50 border border-gray-800 rounded-xl p-3 text-white outline-none focus:border-purple-500 resize-none text-xs" 
                  />

                  {studioTab === 'pro' && (
                    <div className="flex gap-2">
                      {(['1K', '2K', '4K'] as const).map(s => (
                        <button key={s} onClick={() => setAiSize(s)} className={`flex-1 py-2 rounded-lg font-black border text-[10px] ${aiSize === s ? 'bg-purple-600 border-purple-400 text-white' : 'border-gray-800 text-gray-500'}`}>{s}</button>
                      ))}
                    </div>
                  )}

                  <button 
                    disabled={isAiLoading} 
                    onClick={() => studioTab === 'flash' ? generateFlashImage() : generateProOrVeo()} 
                    className="w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl font-black text-base shadow-xl hover:scale-[1.01] active:scale-95 disabled:opacity-50 transition-all uppercase italic">
                    {isAiLoading ? 'YÜKLENİYOR...' : studioTab === 'flash' ? 'HIZLI ÜRET ✨' : studioTab === 'pro' ? 'PRO ÜRET (KEY) 💎' : 'VİDEO ÜRET (KEY) 🎬'}
                  </button>
                </div>
              </div>

              {veoVideoUrl && studioTab === 'veo' && (
                <div className="w-full aspect-video bg-black rounded-xl overflow-hidden border border-purple-500 shadow-2xl">
                  <video src={veoVideoUrl} controls autoPlay loop className="w-full h-full object-cover" />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CORE GAME COMPONENTS */}
      {isGameActive && (
        <>
          <GameCanvas 
            key={gameId} 
            status={status} 
            playerStats={playerStats} 
            onUpdateStats={s => setPlayerStats(p => ({...p, ...s}))} 
            onLevelUp={handleLevelUp} 
            onGameOver={() => setStatus(GameStatus.GAME_OVER)} 
          />
          <HUD stats={playerStats} isMuted={isMuted} onToggleMute={() => setIsMuted(toggleMute())} />
        </>
      )}

      {status === GameStatus.PAUSED_MANUAL && (
        <div className="absolute inset-0 z-[200] bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
          <h2 className="text-6xl font-black text-cyan-400 mb-6 italic tracking-tighter">DURAKLATILDI</h2>
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <button onClick={() => setStatus(GameStatus.PLAYING)} className="py-4 bg-cyan-600 hover:bg-cyan-500 font-bold text-lg rounded-xl shadow-lg transition-transform active:scale-95 uppercase">DEVAM ET</button>
            <button onClick={() => setStatus(GameStatus.MENU)} className="py-2 text-gray-400 font-bold text-xs uppercase hover:text-white transition-colors">ANA MENÜYE DÖN</button>
          </div>
        </div>
      )}

      {status === GameStatus.LEVEL_UP && (
        <LevelUpModal options={upgradeOptions} onSelect={opt => {
          setPlayerStats(p => {
            const n = {...p, level: p.level + 1, xp: 0, xpToNextLevel: Math.floor(p.xpToNextLevel * 1.5)};
            const v = typeof opt.value === 'number' ? opt.value : 0;
            if (opt.type === 'damage') n.damage *= (1 + v);
            if (opt.type === 'speed') n.speed += v;
            if (opt.type === 'fireRate') n.fireRate = Math.max(6, Math.floor(n.fireRate * (1 - v)));
            if (opt.type === 'heal') n.hp = Math.min(n.maxHp, n.hp + v);
            if (opt.type === 'weapon' && typeof opt.value === 'string' && !n.weapons.includes(opt.value)) n.weapons = [...n.weapons, opt.value];
            if (opt.type === 'multishot') n.projectileCount += v;
            return n;
          });
          setStatus(GameStatus.PLAYING);
          playSound('upgrade');
        }} />
      )}
      
      {status === GameStatus.GAME_OVER && <GameOverModal stats={playerStats} onRestart={startGame} />}
    </div>
  );
};

export default App;
