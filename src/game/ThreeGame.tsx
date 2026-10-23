import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { ThreeBikeScene, Game3DCallbacks } from './ThreeBikeScene';
import { LevelConfig, BikeModel } from '../types/game';

export interface ThreeGameHandle {
  setSteerLeft: (active: boolean) => void;
  setSteerRight: (active: boolean) => void;
  setBrake: (active: boolean) => void;
  setBoost: (active: boolean) => void;
  setPaused: (paused: boolean) => void;
  continueFromRevive: () => void;
  restartLevel: () => void;
}

interface ThreeGameProps {
  levelConfig: LevelConfig;
  bikeModel: BikeModel;
  callbacks: Game3DCallbacks;
}

export const ThreeGame = forwardRef<ThreeGameHandle, ThreeGameProps>(
  ({ levelConfig, bikeModel, callbacks }, ref) => {
    const mountRef = useRef<HTMLDivElement>(null);
    const sceneInstanceRef = useRef<ThreeBikeScene | null>(null);

    // Keep callbacks fresh in ref
    const callbacksRef = useRef<Game3DCallbacks>(callbacks);
    callbacksRef.current = callbacks;

    const startLevel = (lvl: LevelConfig, bike: BikeModel) => {
      if (!mountRef.current) return;

      if (sceneInstanceRef.current) {
        sceneInstanceRef.current.destroy();
        sceneInstanceRef.current = null;
      }

      sceneInstanceRef.current = new ThreeBikeScene(
        mountRef.current,
        lvl,
        bike,
        {
          onStatsUpdate: (stats) => callbacksRef.current.onStatsUpdate(stats),
          onGameOver: (stats) => callbacksRef.current.onGameOver(stats),
          onVictory: (stats) => callbacksRef.current.onVictory(stats),
        }
      );
    };

    useEffect(() => {
      startLevel(levelConfig, bikeModel);

      return () => {
        if (sceneInstanceRef.current) {
          sceneInstanceRef.current.destroy();
          sceneInstanceRef.current = null;
        }
      };
    }, [levelConfig.id, bikeModel.id]);

    useImperativeHandle(ref, () => ({
      setSteerLeft: (active: boolean) => sceneInstanceRef.current?.setSteerLeft(active),
      setSteerRight: (active: boolean) => sceneInstanceRef.current?.setSteerRight(active),
      setBrake: (active: boolean) => sceneInstanceRef.current?.setBrake(active),
      setBoost: (active: boolean) => sceneInstanceRef.current?.setBoost(active),
      setPaused: (paused: boolean) => sceneInstanceRef.current?.setPaused(paused),
      continueFromRevive: () => sceneInstanceRef.current?.continueFromRevive(),
      restartLevel: () => startLevel(levelConfig, bikeModel),
    }));

    return (
      <div
        data-testid="three-canvas-container"
        ref={mountRef}
        className="w-full h-full relative overflow-hidden select-none touch-none"
      />
    );
  }
);

ThreeGame.displayName = 'ThreeGame';
