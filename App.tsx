
import React, { useState, useCallback, useEffect } from 'react';
import GameCanvas from './components/GameCanvas';
import HUD from './components/HUD';
import LevelUpModal from './components/LevelUpModal';
import GameOverModal from './components/GameOverModal';
import { GameStatus, PlayerStats, UpgradeOption, PersistentData } from './types';
import { INITIAL_PLAYER_STATS, UPGRADE_POOL, CHARACTERS } from './constants';

const App: React.FC = () => {
  const [status, setStatus] = useState<GameStatus>(GameStatus.MENU);
  const [playerStats, setPlayerStats] = useState<PlayerStats>({ ...INITIAL_PLAYER_STATS });
  const [upgradeOptions, setUpgradeOptions] = useState<UpgradeOption[]>([]);
  const [upgradeTrigger, setUpgradeTrigger] = useState(0);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [gameId, setGameId] = useState(0);

  const [persistentData, setPersistentData] = useState<PersistentData>({
    totalKills: 0,
    maxLevel: 1,
    longestRun: 0,
  });

  const [selectedCharId, setSelectedCharId] = useState<string>('default');

  useEffect(() => {
    const saved = localStorage.getItem('neonSurvivorData');
    if (saved) { try { setPersistentData(JSON.parse(saved)); } catch (e) { console.error("Failed to load save data"); } }
  }, []);

  const saveProgress = useCallback((currentRunStats: PlayerStats, durationSeconds: number) => {
    setPersistentData(prev => {
      const newData = {
        totalKills: prev.totalKills + currentRunStats.killCount,
        maxLevel: Math.max(prev.maxLevel, currentRunStats.level),
        longestRun: Math.max(prev.longestRun, durationSeconds)
      };
      localStorage.setItem('neonSurvivorData', JSON.stringify(newData));
      return newData;
    });
  }, []);

  const resetProgress = () => {
    if (confirm("Tüm ilerlemeyi sıfırlamak istediğine emin misin?")) {
      const resetData = { totalKills: 0, maxLevel: 1, longestRun: 0 };
      setPersistentData(resetData);
      localStorage.setItem('neonSurvivorData', JSON.stringify(resetData));
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        setStatus(prev => {
          if (prev === GameStatus.PLAYING) return GameStatus.PAUSED_MANUAL;
          if (prev === GameStatus.PAUSED_MANUAL) return GameStatus.PLAYING;
          return prev;
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const startGame = () => {
    setAudioEnabled(true);
    const char = CHARACTERS.find(c => c.id === selectedCharId) || CHARACTERS[0];
    const newStats = { 
      ...INITIAL_PLAYER_STATS, 
      ...char.baseStats,
      color: char.color,
      characterId: char.id,
      weapons: char.baseStats.weapons || ['claw']
    };
    setPlayerStats(newStats);
    setGameId(prev => prev + 1);
    setStatus(GameStatus.PLAYING);
  };

  const handleGameOver = useCallback((durationSeconds: number) => {
    setStatus(GameStatus.GAME_OVER);
    saveProgress(playerStats, durationSeconds);
  }, [playerStats, saveProgress]);

  const handleUpdateStats = useCallback((newStats: Partial<PlayerStats>) => {
    setPlayerStats(prev => {
      if ((newStats.hp !== undefined && Math.abs(prev.hp - newStats.hp) < 0.1) &&
          (newStats.xp === undefined || prev.xp === newStats.xp) &&
          (newStats.killCount === undefined || prev.killCount === newStats.killCount)) {
        return prev;
      }
      return { ...prev, ...newStats };
    });
  }, []);

  const handleLevelUp = useCallback(() => {
    setStatus(GameStatus.LEVEL_UP);
    const shuffled = [...UPGRADE_POOL].sort(() => 0.5 - Math.random());
    setUpgradeOptions(shuffled.slice(0, 3));
  }, []);

  const handleSelectUpgrade = useCallback((option: UpgradeOption) => {
    setPlayerStats(prev => {
      const next = { ...prev };
      if (option.type === 'weapon') { 
          const wpnName = option.value as string;
          if (!next.weapons.includes(wpnName)) {
              next.weapons = [...next.weapons, wpnName];
          } else {
              next.damage *= 1.2;
              next.fireRate *= 0.9;
          }
      } 
      else if (option.type === 'aura') { next.hasAura = true; if (prev.hasAura) next.auraRadius += 20; }
      else if (option.type === 'orbital') { next.hasOrbitals = true; next.orbitalCount += 1; }
      else {
        const val = Number(option.value);
        switch (option.type) {
          case 'damage': next.damage *= (1 + val); break;
          case 'speed': next.speed *= (1 + val); break;
          case 'fireRate': next.fireRate = Math.max(5, next.fireRate * (1 - val)); break;
          case 'bulletSpeed': next.bulletSpeed *= (1 + val); break;
          case 'penetration': next.penetration += val; break;
          case 'heal': next.hp = Math.min(next.maxHp, next.hp + val); break;
          case 'multishot': next.projectileCount += val; break;
        }
      }
      next.level += 1;
      next.xp -= next.xpToNextLevel; 
      next.xpToNextLevel = Math.floor(next.xpToNextLevel * 1.4); 
      return next;
    });
    setStatus(GameStatus.PLAYING);
    setUpgradeTrigger(t => t + 1); 
  }, []);

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden font-sans select-none">
      {status === GameStatus.MENU && (
        <div className="absolute inset-0 z-20 bg-[#0a0a12] text-white overflow-y-auto">
          {/* Main flex container starts from the top to allow proper scrolling */}
          <div className="min-h-full flex flex-col items-center py-12 px-4 md:px-8">
            <div className="max-w-5xl w-full flex flex-col items-center">
              <h1 className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-br from-cyan-400 to-purple-600 mb-2 drop-shadow-[0_0_25px_rgba(6,182,212,0.6)] tracking-tighter text-center">
                NEON SURVIVOR
              </h1>
              <p className="text-purple-300 mb-8 text-sm md:text-lg tracking-widest uppercase text-center">Karakterini Seç ve Hayatta Kal</p>
              
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-10 w-full">
                {CHARACTERS.map(char => {
                  const unlocked = char.isUnlocked(persistentData);
                  const selected = selectedCharId === char.id;
                  return (
                    <button key={char.id} disabled={!unlocked} onClick={() => setSelectedCharId(char.id)}
                      className={`relative p-4 md:p-5 rounded-xl border-2 transition-all duration-300 flex flex-col items-center text-center
                        ${selected ? 'border-cyan-400 bg-cyan-900/30 scale-105 shadow-[0_0_20px_rgba(6,182,212,0.3)]' : 'border-gray-800 bg-gray-900/50 hover:bg-gray-800'}
                        ${!unlocked ? 'opacity-50 grayscale cursor-not-allowed' : 'cursor-pointer'}`}>
                      <div className="text-4xl md:text-5xl mb-2 md:mb-3">{char.icon}</div>
                      <div className="font-bold text-lg md:text-xl mb-1">{char.name}</div>
                      <div className="text-[10px] md:text-xs text-gray-400 mb-2 min-h-[32px] leading-tight">{char.description}</div>
                      <div className="text-[9px] md:text-[10px] text-cyan-500 font-bold uppercase tracking-tighter bg-cyan-950 px-2 py-1 rounded">ÖZEL: {char.specialName}</div>
                      {!unlocked && (
                        <div className="absolute inset-0 bg-black/90 flex items-center justify-center rounded-xl backdrop-blur-[2px] p-2">
                          <div className="text-center">
                            <div className="text-xl md:text-2xl mb-1">🔒</div>
                            <div className="text-[9px] md:text-[10px] text-red-400 font-bold uppercase tracking-wider">{char.unlockCondition}</div>
                          </div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap justify-center gap-4 md:gap-8 mb-8 text-[10px] md:text-xs uppercase tracking-widest bg-gray-900/50 p-4 rounded-lg border border-gray-800">
                 <div>En İyi Seviye: <span className="text-white font-bold">{persistentData.maxLevel}</span></div>
                 <div>Toplam Leş: <span className="text-white font-bold">{persistentData.totalKills}</span></div>
                 <div>En Uzun Süre: <span className="text-white font-bold">{persistentData.longestRun}s</span></div>
              </div>

              <div className="flex flex-col gap-4 items-center">
                <button onClick={startGame} className="px-12 md:px-16 py-4 md:py-6 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-black text-2xl md:text-3xl rounded-2xl transition-all hover:scale-105 shadow-[0_0_40px_rgba(6,182,212,0.4)]">
                  AV BAŞLASIN
                </button>
                <button onClick={resetProgress} className="text-red-500 hover:text-red-400 text-[10px] font-bold uppercase tracking-widest mt-4 opacity-50 hover:opacity-100 transition-opacity">Sıfırla & Geri Yükle</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {status === GameStatus.PAUSED_MANUAL && (
         <div className="absolute inset-0 flex flex-col items-center justify-center z-50 bg-black/80 backdrop-blur-sm">
           <div className="bg-gray-900 border-2 border-cyan-500/50 p-12 rounded-2xl text-center shadow-[0_0_50px_rgba(0,0,0,0.8)]">
              <h2 className="text-5xl font-bold text-white mb-12 tracking-widest">DURAKLATILDI</h2>
              <div className="flex flex-col gap-6 w-64">
                <button onClick={() => setStatus(GameStatus.PLAYING)} className="px-8 py-4 bg-green-600 hover:bg-green-500 text-white font-bold text-xl rounded transition-colors">DEVAM ET</button>
                <button onClick={() => setStatus(GameStatus.MENU)} className="px-8 py-4 bg-gray-700 hover:bg-gray-600 text-white font-bold text-xl rounded transition-colors">ÇIKIŞ YAP</button>
              </div>
           </div>
         </div>
      )}

      {(status === GameStatus.PLAYING || status === GameStatus.LEVEL_UP || status === GameStatus.PAUSED_MANUAL || status === GameStatus.GAME_OVER) && (
        <>
          <GameCanvas 
            key={gameId} 
            status={status}
            playerStats={playerStats}
            audioEnabled={audioEnabled}
            onUpdateStats={handleUpdateStats}
            onLevelUp={handleLevelUp}
            onGameOver={() => handleGameOver(0)}
            setUpgradeTrigger={setUpgradeTrigger}
            saveTimeCallback={(time) => handleGameOver(time)}
          />
          <HUD stats={playerStats} />
        </>
      )}

      {status === GameStatus.LEVEL_UP && <LevelUpModal options={upgradeOptions} onSelect={handleSelectUpgrade} />}
      {status === GameStatus.GAME_OVER && <GameOverModal stats={playerStats} onRestart={startGame} />}
    </div>
  );
};

export default App;
