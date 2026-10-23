import React, { useState } from 'react';
import { LevelConfig } from '../types/game';
import { adsgram } from '../services/adsgram';
import { formatDistance } from '../game/rules';
import { RotateCcw, Play, Film, AlertTriangle, ArrowLeft, ShieldCheck, Loader2 } from 'lucide-react';
import { telegram } from '../services/telegram';

interface GameOverModalProps {
  level: LevelConfig;
  distanceReached: number;
  score: number;
  nearMisses: number;
  continueUsed: boolean;
  onContinueWithShield: () => void;
  onRestart: () => void;
  onMenu: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  level,
  distanceReached,
  score,
  nearMisses,
  continueUsed,
  onContinueWithShield,
  onRestart,
  onMenu,
}) => {
  const [isAdLoading, setIsAdLoading] = useState(false);
  const [adFeedbackMessage, setAdFeedbackMessage] = useState<string | null>(null);

  const progressPercent = Math.min(100, Math.round((distanceReached / level.targetDistance) * 100));

  const handleWatchRewardedAd = async () => {
    if (continueUsed || isAdLoading) return;

    setIsAdLoading(true);
    setAdFeedbackMessage(null);
    telegram.hapticImpact('light');

    try {
      const response = await adsgram.showRewardedAd();

      if (response.success) {
        telegram.hapticNotification('success');
        setAdFeedbackMessage(response.message);
        // Reward verified! Trigger continue with shield
        setTimeout(() => {
          onContinueWithShield();
        }, 300);
      } else {
        telegram.hapticNotification('warning');
        setAdFeedbackMessage(response.message);
      }
    } catch (err: any) {
      telegram.hapticNotification('error');
      setAdFeedbackMessage('Unable to display advertisement. You can restart the level freely.');
    } finally {
      setIsAdLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 select-none">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-5 flex flex-col gap-4 text-center animate-in fade-in zoom-in-95 duration-200">
        {/* Crash Header */}
        <div className="flex flex-col items-center gap-1.5">
          <div className="w-12 h-12 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-black text-white tracking-wider uppercase">
            Crash Detected
          </h2>
          <p className="text-xs text-slate-400 font-mono">
            {level.title} &middot; Level {level.id}
          </p>
        </div>

        {/* Run Performance Summary */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 flex flex-col gap-2">
          {/* Progress bar to objective */}
          <div>
            <div className="flex justify-between text-xs font-mono text-slate-300 mb-1">
              <span>Distance Reached</span>
              <span className="font-bold text-cyan-400">
                {formatDistance(distanceReached)} / {formatDistance(level.targetDistance)} ({progressPercent}%)
              </span>
            </div>
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-rose-500 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/80">
            <div className="text-center p-1.5 bg-slate-900/50 rounded-lg">
              <div className="text-[10px] uppercase font-bold text-slate-400">Total Score</div>
              <div className="text-lg font-black font-mono text-white tabular-nums">{score}</div>
            </div>
            <div className="text-center p-1.5 bg-slate-900/50 rounded-lg">
              <div className="text-[10px] uppercase font-bold text-amber-400">Near Misses</div>
              <div className="text-lg font-black font-mono text-amber-300 tabular-nums">{nearMisses}</div>
            </div>
          </div>
        </div>

        {/* Optional Ad Feedback Banner (Error or notice) */}
        {adFeedbackMessage && (
          <div className="text-xs p-2.5 rounded-lg bg-slate-800/90 border border-amber-500/40 text-amber-300 font-sans text-left leading-tight">
            {adFeedbackMessage}
          </div>
        )}

        {/* Options Container */}
        <div className="flex flex-col gap-2.5 pt-1">
          {/* OPTION A: Watch Ad & Continue */}
          {!continueUsed ? (
            <div className="flex flex-col gap-1">
              <button
                onClick={handleWatchRewardedAd}
                disabled={isAdLoading}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 active:scale-[0.98] transition-all text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/40 disabled:opacity-75 cursor-pointer"
                aria-label="Watch Ad and Continue"
              >
                {isAdLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-cyan-200" />
                    <span>Loading Sponsor Ad (বিজ্ঞাপন লোড হচ্ছে)...</span>
                  </>
                ) : (
                  <>
                    <Film className="w-4 h-4 text-cyan-200" />
                    <span>Watch Ad & Continue (1 Left)</span>
                  </>
                )}
              </button>
              <span className="text-[10px] text-slate-400 leading-tight">
                * Optional Rewarded Video by Adsgram. Revives bike at current distance with a 3.5s golden shield.
              </span>
            </div>
          ) : (
            <div className="p-2 rounded-xl bg-slate-950/50 border border-slate-800 text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
              <span>Continue already used for this run attempt (1 max)</span>
            </div>
          )}

          {/* OPTION B: Restart Level (Free, instant, always available) */}
          <button
            onClick={onRestart}
            data-start="true"
            className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-[0.98] transition-all text-white font-bold text-sm flex items-center justify-center gap-2 border border-slate-700 cursor-pointer shadow"
            aria-label="Restart Level"
          >
            <RotateCcw className="w-4 h-4 text-emerald-400" />
            <span>Restart Level (Instant & Free)</span>
          </button>

          {/* OPTION C: Return to Level Select / Main Menu */}
          <button
            onClick={onMenu}
            className="w-full py-2 px-3 rounded-lg text-slate-400 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-slate-800/50 transition-colors cursor-pointer"
            aria-label="Back to Menu"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Level Select</span>
          </button>
        </div>
      </div>
    </div>
  );
};
