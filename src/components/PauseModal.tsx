import React from 'react';
import { LevelConfig } from '../types/game';
import { formatDistance } from '../game/rules';
import { Play, RotateCcw, ListFilter, Home } from 'lucide-react';

interface PauseModalProps {
  level: LevelConfig;
  distance: number;
  score: number;
  onResume: () => void;
  onRestart: () => void;
  onLevelSelect: () => void;
  onTitle: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  level,
  distance,
  score,
  onResume,
  onRestart,
  onLevelSelect,
  onTitle,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 select-none">
      <div className="w-full max-w-xs bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-5 flex flex-col gap-4 text-center animate-in fade-in zoom-in-95 duration-150">
        <div className="flex flex-col items-center gap-1">
          <h2 className="text-xl font-black text-white tracking-wider uppercase">
            Game Paused
          </h2>
          <p className="text-xs text-slate-400 font-mono">
            {level.title} &middot; Level {level.id}
          </p>
        </div>

        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 flex justify-between text-xs font-mono">
          <div>
            <div className="text-[10px] text-slate-500 uppercase">Distance</div>
            <div className="font-bold text-cyan-400">{formatDistance(distance)}</div>
          </div>
          <div className="h-7 w-px bg-slate-800" />
          <div>
            <div className="text-[10px] text-slate-500 uppercase">Score</div>
            <div className="font-bold text-white tabular-nums">{score}</div>
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-1">
          <button
            onClick={onResume}
            className="w-full py-3 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 active:scale-[0.98] transition-all text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/40 cursor-pointer"
            aria-label="Resume Game"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>Resume</span>
          </button>

          <button
            onClick={onRestart}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-[0.98] transition-all text-slate-200 font-semibold text-xs flex items-center justify-center gap-2 border border-slate-700 cursor-pointer"
            aria-label="Restart Level"
          >
            <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
            <span>Restart Level</span>
          </button>

          <button
            onClick={onLevelSelect}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-800/60 hover:bg-slate-700 active:scale-[0.98] transition-all text-slate-300 font-semibold text-xs flex items-center justify-center gap-2 border border-slate-800 cursor-pointer"
            aria-label="Level Select"
          >
            <ListFilter className="w-3.5 h-3.5 text-amber-400" />
            <span>Change Level</span>
          </button>

          <button
            onClick={onTitle}
            className="w-full py-1.5 text-slate-500 hover:text-slate-300 text-xs font-medium flex items-center justify-center gap-1 cursor-pointer"
            aria-label="Back to Title Screen"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Main Menu</span>
          </button>
        </div>
      </div>
    </div>
  );
};
