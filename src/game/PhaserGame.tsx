import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import * as Phaser from 'phaser';
import { BikeScene, GameCallbacks } from './BikeScene';
import { LevelConfig, BikeModel } from '../types/game';

export interface PhaserGameHandle {
  setSteerLeft: (active: boolean) => void;
  setSteerRight: (active: boolean) => void;
  setBrake: (active: boolean) => void;
  setBoost: (active: boolean) => void;
  setPaused: (paused: boolean) => void;
  continueFromRevive: () => void;
  restartLevel: () => void;
}

interface PhaserGameProps {
  levelConfig: LevelConfig;
  bikeModel: BikeModel;
  callbacks: GameCallbacks;
}

export const PhaserGame = forwardRef<PhaserGameHandle, PhaserGameProps>(
  ({ levelConfig, bikeModel, callbacks }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const gameInstanceRef = useRef<Phaser.Game | null>(null);
    const sceneRef = useRef<BikeScene | null>(null);

    // Keep callbacks fresh in ref so Phaser doesn't hold stale closures
    const callbacksRef = useRef<GameCallbacks>(callbacks);
    callbacksRef.current = callbacks;

    const startLevel = (lvl: LevelConfig, bike: BikeModel) => {
      if (!containerRef.current) return;

      // Clean up previous game if any
      if (gameInstanceRef.current) {
        gameInstanceRef.current.destroy(true);
        gameInstanceRef.current = null;
      }

      const config: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        parent: containerRef.current,
        width: 440,
        height: 780,
        backgroundColor: '#090d16',
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
          width: 440,
          height: 780,
        },
        physics: {
          default: 'arcade',
          arcade: {
            debug: false,
          },
        },
      };

      const game = new Phaser.Game(config);
      gameInstanceRef.current = game;

      const scene = game.scene.add('BikeScene', BikeScene, true, {
        levelConfig: lvl,
        bikeModel: bike,
        callbacks: {
          onStatsUpdate: (stats: any) => callbacksRef.current.onStatsUpdate(stats),
          onGameOver: (stats: any) => callbacksRef.current.onGameOver(stats),
          onVictory: (stats: any) => callbacksRef.current.onVictory(stats),
        },
      }) as BikeScene;
      sceneRef.current = scene;
    };

    useEffect(() => {
      startLevel(levelConfig, bikeModel);

      return () => {
        if (gameInstanceRef.current) {
          gameInstanceRef.current.destroy(true);
          gameInstanceRef.current = null;
        }
      };
    }, [levelConfig.id, bikeModel.id]);

    useImperativeHandle(ref, () => ({
      setSteerLeft: (active: boolean) => sceneRef.current?.setSteerLeft(active),
      setSteerRight: (active: boolean) => sceneRef.current?.setSteerRight(active),
      setBrake: (active: boolean) => sceneRef.current?.setBrake(active),
      setBoost: (active: boolean) => sceneRef.current?.setBoost(active),
      setPaused: (paused: boolean) => sceneRef.current?.setPaused(paused),
      continueFromRevive: () => sceneRef.current?.continueFromRevive(),
      restartLevel: () => startLevel(levelConfig, bikeModel),
    }));

    return (
      <div
        data-testid="phaser-game-container"
        ref={containerRef}
        className="w-full h-full flex items-center justify-center overflow-hidden touch-none"
      />
    );
  }
);

PhaserGame.displayName = 'PhaserGame';
