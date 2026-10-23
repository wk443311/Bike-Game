/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameState, PlayerStats, UserProgress } from './types/game';
import { ALL_LEVELS, ALL_BIKES, getLevelById, getBikeById } from './game/levels';
import {
  loadUserProgress,
  saveUserProgress,
  recordLevelCompletion,
  unlockBike,
  resetAllProgress,
} from './services/storage';
import { telegram } from './services/telegram';
import { sound } from './services/audio';
import { ThreeGame, ThreeGameHandle } from './game/ThreeGame';
import { TitleScreen } from './components/TitleScreen';
import { GameHUD } from './components/GameHUD';
import { PauseModal } from './components/PauseModal';
import { GameOverModal } from './components/GameOverModal';
import { VictoryModal } from './components/VictoryModal';
import { LevelSelectModal } from './components/LevelSelectModal';
import { GarageModal } from './components/GarageModal';
import { ComplianceModal } from './components/ComplianceModal';

export default function App() {
  const [gameState, setGameState] = useState<GameState>('title');
  const [progress, setProgress] = useState<UserProgress>(loadUserProgress);
  const [showComplianceModal, setShowComplianceModal] = useState<boolean>(false);

  // Run stats
  const [liveStats, setLiveStats] = useState<PlayerStats>({
    score: 0,
    distance: 0,
    speedKmh: 0,
    nearMisses: 0,
    coinsEarned: 0,
    timeElapsedSeconds: 0,
    nitroPercent: 100,
  });

  const [lastRunStats, setLastRunStats] = useState<{
    distance: number;
    score: number;
    nearMisses: number;
    timeElapsed: number;
  }>({
    distance: 0,
    score: 0,
    nearMisses: 0,
    timeElapsed: 0,
  });

  const [continueUsedInAttempt, setContinueUsedInAttempt] = useState<boolean>(false);

  const gameHandleRef = useRef<ThreeGameHandle | null>(null);

  const currentLevel = getLevelById(progress.selectedLevelId);
  const currentBike = getBikeById(progress.selectedBikeId);

  // Sync dataset.state with current game state
  useEffect(() => {
    let bodyState = 'title';
    if (gameState === 'playing') bodyState = 'playing';
    else if (gameState === 'paused') bodyState = 'paused';
    else if (gameState === 'gameover' || gameState === 'victory') bodyState = 'gameover';
    else bodyState = 'title';

    document.body.dataset.state = bodyState;
  }, [gameState]);

  // Sync Telegram BackButton
  useEffect(() => {
    if (gameState === 'levelselect' || gameState === 'garage') {
      telegram.setBackButton(true, () => setGameState('title'));
    } else if (gameState === 'playing') {
      telegram.setBackButton(true, () => handlePauseGame());
    } else {
      telegram.setBackButton(false);
    }
  }, [gameState]);

  // Handle ?autostart=1 query parameter
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1') {
        startGame();
      }
    }
  }, []);

  // Global Keyboard listener for Pause (P or Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'p' || e.key === 'P' || e.key === 'Escape') && gameState === 'playing') {
        handlePauseGame();
      } else if ((e.key === 'p' || e.key === 'P' || e.key === 'Escape') && gameState === 'paused') {
        handleResumeGame();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState]);

  // Game Loop Callbacks
  const startGame = useCallback((levelId?: number) => {
    if (levelId) {
      setProgress((prev) => {
        const updated = { ...prev, selectedLevelId: levelId };
        saveUserProgress(updated);
        return updated;
      });
    }
    setContinueUsedInAttempt(false);
    setLiveStats({
      score: 0,
      distance: 0,
      speedKmh: 60,
      nearMisses: 0,
      coinsEarned: 0,
      timeElapsedSeconds: 0,
      nitroPercent: 100,
    });
    setGameState('playing');
  }, []);

  const handlePauseGame = () => {
    gameHandleRef.current?.setPaused(true);
    setGameState('paused');
  };

  const handleResumeGame = () => {
    gameHandleRef.current?.setPaused(false);
    setGameState('playing');
  };

  const handleRestartLevel = () => {
    setContinueUsedInAttempt(false);
    setLiveStats({
      score: 0,
      distance: 0,
      speedKmh: 60,
      nearMisses: 0,
      coinsEarned: 0,
      timeElapsedSeconds: 0,
      nitroPercent: 100,
    });
    gameHandleRef.current?.restartLevel();
    setGameState('playing');
  };

  const handleGameOver = useCallback((finalStats: { distance: number; score: number; nearMisses: number }) => {
    setLastRunStats({
      ...finalStats,
      timeElapsed: liveStats.timeElapsedSeconds,
    });
    setGameState('gameover');
  }, [liveStats.timeElapsedSeconds]);

  const handleVictory = useCallback((finalStats: { distance: number; score: number; nearMisses: number; timeElapsed: number }) => {
    setLastRunStats(finalStats);

    // Save completion and unlock next level
    const updated = recordLevelCompletion(
      progress,
      currentLevel.id,
      finalStats.score,
      finalStats.distance,
      3, // base high performance
      finalStats.nearMisses,
      currentLevel.rewardCoins
    );
    setProgress(updated);
    setGameState('victory');
  }, [progress, currentLevel]);

  // Verified Adsgram Rewarded Continue
  const handleContinueWithShield = () => {
    setContinueUsedInAttempt(true);
    setGameState('playing');
    gameHandleRef.current?.continueFromRevive();
  };

  const handleNextLevel = () => {
    const nextId = Math.min(20, currentLevel.id + 1);
    startGame(nextId);
  };

  const handleSelectLevelFromModal = (lvlId: number) => {
    setProgress((prev) => {
      const updated = { ...prev, selectedLevelId: lvlId };
      saveUserProgress(updated);
      return updated;
    });
    startGame(lvlId);
  };

  const handleSelectBike = (bikeId: string) => {
    setProgress((prev) => {
      const updated = { ...prev, selectedBikeId: bikeId };
      saveUserProgress(updated);
      return updated;
    });
  };

  const handleBuyBike = (bikeId: string, cost: number) => {
    const updated = unlockBike(progress, bikeId, cost);
    setProgress(updated);
  };

  const handleToggleMute = () => {
    const newMuted = !progress.audioMuted;
    sound.setMuted(newMuted);
    setProgress((prev) => {
      const updated = { ...prev, audioMuted: newMuted };
      saveUserProgress(updated);
      return updated;
    });
  };

  const handleResetProgress = () => {
    const reset = resetAllProgress();
    setProgress(reset);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#090d16] flex items-center justify-center font-sans">
      {/* Title Screen */}
      {gameState === 'title' && (
        <TitleScreen
          progress={progress}
          onStartGame={() => startGame()}
          onOpenLevels={() => setGameState('levelselect')}
          onOpenGarage={() => setGameState('garage')}
          onOpenCompliance={() => setShowComplianceModal(true)}
          onToggleMute={handleToggleMute}
          onResetProgress={handleResetProgress}
        />
      )}

      {/* Active 3D Three.js Game Canvas (Visible when playing, paused, gameover, victory) */}
      {gameState !== 'title' && gameState !== 'levelselect' && gameState !== 'garage' && (
        <div className="relative w-full h-full max-w-[480px] max-h-[850px] shadow-2xl overflow-hidden bg-slate-950">
          <ThreeGame
            ref={gameHandleRef}
            levelConfig={currentLevel}
            bikeModel={currentBike}
            callbacks={{
              onStatsUpdate: (s) => setLiveStats(s),
              onGameOver: handleGameOver,
              onVictory: handleVictory,
            }}
          />

          {/* In-Game HUD & Touch Controls */}
          {gameState === 'playing' && (
            <GameHUD
              level={currentLevel}
              stats={liveStats}
              isMuted={progress.audioMuted}
              continueUsed={continueUsedInAttempt}
              onToggleMute={handleToggleMute}
              onPause={handlePauseGame}
              onSteerLeft={(active) => gameHandleRef.current?.setSteerLeft(active)}
              onSteerRight={(active) => gameHandleRef.current?.setSteerRight(active)}
              onBrake={(active) => gameHandleRef.current?.setBrake(active)}
              onBoost={(active) => gameHandleRef.current?.setBoost(active)}
            />
          )}

          {/* Pause Modal */}
          {gameState === 'paused' && (
            <PauseModal
              level={currentLevel}
              distance={liveStats.distance}
              score={liveStats.score}
              onResume={handleResumeGame}
              onRestart={handleRestartLevel}
              onLevelSelect={() => setGameState('levelselect')}
              onTitle={() => setGameState('title')}
            />
          )}

          {/* Game Over Modal with verified Adsgram Continue & free Restart */}
          {gameState === 'gameover' && (
            <GameOverModal
              level={currentLevel}
              distanceReached={lastRunStats.distance}
              score={lastRunStats.score}
              nearMisses={lastRunStats.nearMisses}
              continueUsed={continueUsedInAttempt}
              onContinueWithShield={handleContinueWithShield}
              onRestart={handleRestartLevel}
              onMenu={() => setGameState('levelselect')}
            />
          )}

          {/* Stage Victory Modal */}
          {gameState === 'victory' && (
            <VictoryModal
              level={currentLevel}
              distanceReached={lastRunStats.distance}
              score={lastRunStats.score}
              nearMisses={lastRunStats.nearMisses}
              timeElapsed={lastRunStats.timeElapsed}
              continueUsed={continueUsedInAttempt}
              onNextLevel={handleNextLevel}
              onReplay={handleRestartLevel}
              onMenu={() => setGameState('levelselect')}
            />
          )}
        </div>
      )}

      {/* Level Select Modal */}
      {gameState === 'levelselect' && (
        <LevelSelectModal
          progress={progress}
          onSelectLevel={handleSelectLevelFromModal}
          onClose={() => setGameState('title')}
        />
      )}

      {/* Garage Modal */}
      {gameState === 'garage' && (
        <GarageModal
          progress={progress}
          onSelectBike={handleSelectBike}
          onBuyBike={handleBuyBike}
          onClose={() => setGameState('title')}
        />
      )}

      {/* Adsgram & Policy Compliance Modal */}
      {showComplianceModal && (
        <ComplianceModal onClose={() => setShowComplianceModal(false)} />
      )}
    </div>
  );
}
