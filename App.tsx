
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
  
  // Game instance ID to force full reset on restart
  const [gameId, setGameId] = useState(0);

  // Persistence
  const [persistentData, setPersistentData] = useState<PersistentData>({
    totalKills: 0,
    maxLevel: 1,
    longestRun: 0,
  });

  const [selectedCharId, setSelectedCharId] = useState<string>('default');

  // Load data on mount
  useEffect(() => {
    const saved = localStorage.getItem('neonSurvivorData');
    if (saved) {
      try {
        setPersistentData(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load save data");
      }
    }
  }, []);

  // Save data helper
  const saveProgress = (currentRunStats: PlayerStats, durationSeconds: number) => {
    const newData = {
      totalKills: persistentData.totalKills + currentRunStats.killCount,
      maxLevel: Math.max(persistentData.maxLevel, currentRunStats.level),
      longestRun: Math.max(persistentData.longestRun, durationSeconds)
    };
    setPersistentData(newData);
    localStorage.setItem('neonSurvivorData', JSON.stringify(newData));
  };

  // Keyboard listener for Pause (ESC)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        setStatus(prevStatus => {
          if (prevStatus === GameStatus.PLAYING) return GameStatus.PAUSED_MANUAL;
          if (prevStatus === GameStatus.PAUSED_MANUAL) return GameStatus.PLAYING;
          return prevStatus;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const startGame = () => {
    setAudioEnabled(true);
    
    // Apply selected character stats
    const char = CHARACTERS.find(c => c.id === selectedCharId) || CHARACTERS[0];
    const newStats = { 
      ...INITIAL_PLAYER_STATS, 
      ...char.baseStats,
      color: char.color,
      characterId: char.id
    };

    setPlayerStats(newStats);
    setGameId(prev => prev + 1); // CRITICAL: Increment ID to remount GameCanvas
    setStatus(GameStatus.PLAYING);
  };

  const resumeGame = () => {
    setStatus(GameStatus.PLAYING);
  };

  const handleGameOver = useCallback((durationSeconds: number) => {
    setStatus(GameStatus.GAME_OVER);
    saveProgress(playerStats, durationSeconds);
  }, [playerStats, persistentData]);

  const handleUpdateStats = useCallback((newStats: Partial<PlayerStats>) => {
    setPlayerStats(prev => {
      // Basic optimization
      if (
        (newStats.hp !== undefined && Math.abs(prev.hp - newStats.hp) < 0.1) &&
        (newStats.xp === undefined || prev.xp === newStats.xp) &&
        (newStats.killCount === undefined || prev.killCount === newStats.killCount)
      ) {
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
        // @ts-ignore
        next.weaponType = option.value;
      } 
      else if (option.type === 'aura') {
         next.hasAura = true;
         // Increase radius if already has it
         if (prev.hasAura) next.auraRadius += 20;
      }
      else if (option.type === 'orbital') {
         next.hasOrbitals = true;
         next.orbitalCount += 1;
      }
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
      next.xpToNextLevel = Math.floor(next.xpToNextLevel * 1.5); 
      
      return next;
    });

    setStatus(GameStatus.PLAYING);
    setUpgradeTrigger(t => t + 1); 
  }, []);

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden font-sans select-none">
      
      {/* Main Menu */}
      {status === GameStatus.MENU && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-[#0a0a12] text-white overflow-y-auto">
          <div className="max-w-4xl w-full flex flex-col items-center p-8">
            <h1 className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-br from-cyan-400 to-purple-600 mb-2 drop-shadow-[0_0_25px_rgba(6,182,212,0.6)] tracking-tighter text-center">
              CAT SURVIVOR
            </h1>
            <p className="text-purple-300 mb-8 text-lg tracking-widest uppercase">Neon Patiler vs Karanlık</p>
            
            {/* Character Selection */}
            <h3 className="text-2xl font-bold mb-4 text-cyan-400">KARAKTER SEÇ</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-10 w-full">
              {CHARACTERS.map(char => {
                const unlocked = char.isUnlocked(persistentData);
                const selected = selectedCharId === char.id;
                
                return (
                  <button
                    key={char.id}
                    disabled={!unlocked}
                    onClick={() => setSelectedCharId(char.id)}
                    className={`
                      relative p-4 rounded-xl border-2 transition-all duration-300 flex flex-col items-center text-center
                      ${selected ? 'border-cyan-400 bg-cyan-900/30 scale-105 shadow-[0_0_20px_rgba(6,182,212,0.3)]' : 'border-gray-800 bg-gray-900/50 hover:bg-gray-800'}
                      ${!unlocked ? 'opacity-50 grayscale cursor-not-allowed' : 'cursor-pointer'}
                    `}
                  >
                    <div className="text-5xl mb-3">{char.icon}</div>
                    <div className="font-bold text-lg mb-1">{char.name}</div>
                    <div className="text-xs text-gray-400 min-h-[40px]">{char.description}</div>
                    
                    {!unlocked && (
                      <div className="absolute inset-0 bg-black/80 flex items-center justify-center rounded-xl backdrop-blur-[2px]">
                        <div className="text-center p-2">
                          <div className="text-2xl mb-1">🔒</div>
                          <div className="text-[10px] text-red-400 font-bold uppercase tracking-wider">{char.unlockCondition}</div>
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Stats Summary */}
            <div className="flex gap-8 mb-8 text-gray-500 text-xs uppercase tracking-widest">
               <div>En İyi Level: <span className="text-white">{persistentData.maxLevel}</span></div>
               <div>Toplam Leş: <span className="text-white">{persistentData.totalKills}</span></div>
               <div>En Uzun Süre: <span className="text-white">{persistentData.longestRun}s</span></div>
            </div>

            <button 
              onClick={startGame}
              className="group relative px-16 py-6 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-black text-3xl rounded-2xl transition-all hover:scale-105 shadow-[0_0_40px_rgba(6,182,212,0.4)] overflow-hidden"
            >
              <span className="relative z-10">AV BAŞLASIN</span>
            </button>
          </div>
        </div>
      )}

      {/* Manual Pause Menu */}
      {status === GameStatus.PAUSED_MANUAL && (
         <div className="absolute inset-0 flex flex-col items-center justify-center z-50 bg-black/80 backdrop-blur-sm">
           <div className="bg-gray-900 border-2 border-cyan-500/50 p-12 rounded-2xl text-center shadow-[0_0_50px_rgba(0,0,0,0.8)]">
              <h2 className="text-5xl font-bold text-white mb-12 tracking-widest">DURAKLATILDI</h2>
              <div className="flex flex-col gap-6 w-64">
                <button 
                  onClick={resumeGame}
                  className="px-8 py-4 bg-green-600 hover:bg-green-500 text-white font-bold text-xl rounded transition-colors"
                >
                  DEVAM ET
                </button>
                <button 
                  onClick={() => setStatus(GameStatus.MENU)}
                  className="px-8 py-4 bg-gray-700 hover:bg-gray-600 text-white font-bold text-xl rounded transition-colors"
                >
                  ÇIKIŞ YAP
                </button>
              </div>
           </div>
         </div>
      )}

      {/* Game Layer */}
      {/* KEY PROP IS CRITICAL FOR RESTART TO WORK CORRECTLY */}
      {(status === GameStatus.PLAYING || status === GameStatus.LEVEL_UP || status === GameStatus.PAUSED_MANUAL || status === GameStatus.GAME_OVER) && (
        <>
          <GameCanvas 
            key={gameId} 
            status={status}
            playerStats={playerStats}
            audioEnabled={audioEnabled}
            onUpdateStats={handleUpdateStats}
            onLevelUp={handleLevelUp}
            onGameOver={() => handleGameOver(0)} // Time passed in gameCanvas internal state usually
            setUpgradeTrigger={setUpgradeTrigger}
            saveTimeCallback={(time) => handleGameOver(time)}
          />
          
          <HUD stats={playerStats} />
        </>
      )}

      {/* Level Up Modal */}
      {status === GameStatus.LEVEL_UP && (
        <LevelUpModal options={upgradeOptions} onSelect={handleSelectUpgrade} />
      )}

      {/* Game Over Modal */}
      {status === GameStatus.GAME_OVER && (
        <GameOverModal stats={playerStats} onRestart={startGame} />
      )}
    </div>
  );
};

export default App;
