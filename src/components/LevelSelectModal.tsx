import React from 'react';
import { ALL_LEVELS } from '../game/levels';
import { UserProgress } from '../types/game';
import { formatDistance } from '../game/rules';
import { Star, Lock, ArrowLeft, Zap, Trophy, Play } from 'lucide-react';

interface LevelSelectModalProps {
  progress: UserProgress;
  onSelectLevel: (levelId: number) => void;
  onClose: () => void;
}

export const LevelSelectModal: React.FC<LevelSelectModalProps> = ({
  progress,
  onSelectLevel,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/90 select-none overflow-y-auto">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-4 flex flex-col gap-3 my-auto animate-in fade-in zoom-in-95 duration-150 max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
              aria-label="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h2 className="text-lg font-black text-white uppercase tracking-wider">
                Select Level (1 - 20)
              </h2>
              <p className="text-[10px] text-slate-400 font-mono">
                Progressive Road Challenge &middot; 20 Distinct Stages
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 text-amber-400 text-xs font-mono font-bold">
            <Trophy className="w-3.5 h-3.5" />
            <span>
              {Object.values(progress.levels).reduce((acc, l) => acc + l.stars, 0)} / 60
            </span>
          </div>
        </div>

        {/* Scrollable Grid of 20 Levels */}
        <div className="overflow-y-auto pr-1 grid grid-cols-2 sm:grid-cols-2 gap-2.5 max-h-[62vh]">
          {ALL_LEVELS.map((level) => {
            const record = progress.levels[level.id];
            const isUnlocked = record?.unlocked || level.id === 1;
            const stars = record?.stars || 0;
            const isCompleted = record?.completed || false;
            const isCurrent = progress.selectedLevelId === level.id;

            return (
              <button
                key={level.id}
                disabled={!isUnlocked}
                onClick={() => isUnlocked && onSelectLevel(level.id)}
                className={`relative p-3 rounded-xl border text-left flex flex-col justify-between min-h-[95px] transition-all cursor-pointer ${
                  !isUnlocked
                    ? 'bg-slate-950/40 border-slate-800/60 opacity-60 cursor-not-allowed'
                    : isCurrent
                    ? 'bg-cyan-950/40 border-cyan-500 shadow-md shadow-cyan-950/40 active:scale-[0.98]'
                    : isCompleted
                    ? 'bg-slate-850/60 border-slate-700 hover:border-slate-600 active:scale-[0.98]'
                    : 'bg-slate-900 border-slate-700 hover:border-cyan-500/70 active:scale-[0.98]'
                }`}
                aria-label={`Level ${level.id}: ${level.title}`}
              >
                {/* Level Tag & Status */}
                <div className="flex items-start justify-between gap-1">
                  <span
                    className={`font-mono font-black text-xs px-1.5 py-0.5 rounded ${
                      isCurrent
                        ? 'bg-cyan-500 text-slate-950'
                        : isCompleted
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : isUnlocked
                        ? 'bg-slate-800 text-slate-200'
                        : 'bg-slate-800/40 text-slate-500'
                    }`}
                  >
                    LVL {level.id}
                  </span>

                  {!isUnlocked ? (
                    <div className="flex items-center gap-1 text-[10px] text-slate-500 font-mono">
                      <Lock className="w-3 h-3" />
                    </div>
                  ) : (
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3].map((s) => (
                        <Star
                          key={s}
                          className={`w-3 h-3 ${
                            s <= stars
                              ? 'text-amber-400 fill-amber-400'
                              : 'text-slate-700'
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Level Title & Details */}
                <div className="py-1">
                  <div className="text-xs font-bold text-white tracking-wide truncate">
                    {level.title}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                    <Zap className="w-2.5 h-2.5 text-cyan-400" />
                    <span>{formatDistance(level.targetDistance)}</span>
                    <span>&middot;</span>
                    <span className="capitalize">{level.theme}</span>
                  </div>
                </div>

                {/* Lock Explanation or High Score */}
                {!isUnlocked ? (
                  <div className="text-[9px] text-rose-400/80 font-mono truncate">
                    Requires Level {level.id - 1} clear
                  </div>
                ) : record?.highScore ? (
                  <div className="text-[9px] text-cyan-300/80 font-mono">
                    Best: {record.highScore} pts
                  </div>
                ) : (
                  <div className="text-[9px] text-emerald-400/80 font-mono flex items-center gap-1">
                    <Play className="w-2.5 h-2.5 fill-current" /> Ready to ride
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
          <span className="text-[11px] text-slate-400 font-mono">
            {Object.values(progress.levels).filter((l) => l.completed).length} / 20 Completed
          </span>
          <button
            onClick={() => onSelectLevel(progress.selectedLevelId)}
            data-start="true"
            className="py-2 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 active:scale-95 transition-all text-white font-bold text-xs flex items-center gap-1.5 shadow cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Play Selected (LVL {progress.selectedLevelId})</span>
          </button>
        </div>
      </div>
    </div>
  );
};
