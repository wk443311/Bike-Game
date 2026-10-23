import React, { useEffect } from 'react';
import { LevelConfig } from '../types/game';
import { formatDistance, calculateStars } from '../game/rules';
import { Trophy, Star, ChevronRight, RotateCcw, ArrowLeft, Coins } from 'lucide-react';
import confetti from 'canvas-confetti';

interface VictoryModalProps {
  level: LevelConfig;
  distanceReached: number;
  score: number;
  nearMisses: number;
  timeElapsed: number;
  continueUsed: boolean;
  onNextLevel: () => void;
  onReplay: () => void;
  onMenu: () => void;
}

export const VictoryModal: React.FC<VictoryModalProps> = ({
  level,
  distanceReached,
  score,
  nearMisses,
  timeElapsed,
  continueUsed,
  onNextLevel,
  onReplay,
  onMenu,
}) => {
  const stars = calculateStars(
    score,
    level.targetDistance,
    distanceReached,
    level.star2Score,
    level.star3Score,
    continueUsed ? 1 : 0,
    nearMisses
  );

  const isFinalLevel = level.id === 20;

  useEffect(() => {
    try {
      confetti({
        particleCount: isFinalLevel ? 120 : 60,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#06b6d4', '#facc15', '#10b981', '#ec4899'],
      });
    } catch {
      // Ignore
    }
  }, [isFinalLevel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 select-none">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-5 flex flex-col gap-4 text-center animate-in fade-in zoom-in-95 duration-200">
        {/* Victory Header */}
        <div className="flex flex-col items-center gap-1.5">
          <div className="w-14 h-14 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/10">
            <Trophy className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-black text-white tracking-wider uppercase">
            {isFinalLevel ? 'Champion of the Road!' : 'Stage Clear!'}
          </h2>
          <p className="text-xs text-slate-400 font-mono">
            {level.title} &middot; Level {level.id}
          </p>
        </div>

        {/* Star Rating Display */}
        <div className="flex items-center justify-center gap-2 py-1">
          {[1, 2, 3].map((starNum) => {
            const isEarned = starNum <= stars;
            return (
              <div
                key={starNum}
                className={`p-2 rounded-xl border transition-all ${
                  isEarned
                    ? 'bg-amber-500/20 border-amber-400 text-amber-400 scale-110 shadow-lg shadow-amber-500/20'
                    : 'bg-slate-800/40 border-slate-800 text-slate-600'
                }`}
              >
                <Star className={`w-6 h-6 ${isEarned ? 'fill-amber-400' : ''}`} />
              </div>
            );
          })}
        </div>

        {/* Performance Stats */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="text-center p-2 bg-slate-900/60 rounded-lg">
              <div className="text-[10px] uppercase font-bold text-slate-400">Total Score</div>
              <div className="text-xl font-black font-mono text-cyan-400 tabular-nums">{score}</div>
            </div>
            <div className="text-center p-2 bg-slate-900/60 rounded-lg">
              <div className="text-[10px] uppercase font-bold text-amber-400">Near Misses</div>
              <div className="text-xl font-black font-mono text-amber-300 tabular-nums">{nearMisses}</div>
            </div>
          </div>

          <div className="flex items-center justify-between px-2 pt-1 border-t border-slate-800/80 text-xs font-mono">
            <span className="text-slate-400">Clear Time: {timeElapsed}s</span>
            <span className="flex items-center gap-1 font-bold text-emerald-400">
              <Coins className="w-3.5 h-3.5 text-amber-400 fill-amber-400" /> +{level.rewardCoins} Coins
            </span>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex flex-col gap-2 pt-1">
          {!isFinalLevel ? (
            <button
              onClick={onNextLevel}
              data-start="true"
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.98] transition-all text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40 cursor-pointer"
              aria-label="Play Next Level"
            >
              <span>Next Level (LVL {level.id + 1})</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={onMenu}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 active:scale-[0.98] transition-all text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-950/40 cursor-pointer"
              aria-label="Grand Prix Champion Menu"
            >
              <Trophy className="w-4 h-4" />
              <span>Claim Grand Prix Champion Trophy!</span>
            </button>
          )}

          <button
            onClick={onReplay}
            className="w-full py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-[0.98] transition-all text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 border border-slate-700 cursor-pointer"
            aria-label="Replay Level"
          >
            <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
            <span>Replay for 3 Stars</span>
          </button>

          <button
            onClick={onMenu}
            className="w-full py-1.5 text-slate-400 hover:text-white text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer"
            aria-label="Back to Level Select"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Level Select</span>
          </button>
        </div>
      </div>
    </div>
  );
};
