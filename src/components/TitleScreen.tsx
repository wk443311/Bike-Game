import React, { useState, useEffect } from 'react';
import { UserProgress } from '../types/game';
import { ALL_LEVELS } from '../game/levels';
import { telegram } from '../services/telegram';
import { sound } from '../services/audio';
import {
  Play,
  ListFilter,
  Wrench,
  Volume2,
  VolumeX,
  ShieldCheck,
  RotateCcw,
  Trophy,
  Coins,
  Sparkles,
} from 'lucide-react';

interface TitleScreenProps {
  progress: UserProgress;
  onStartGame: () => void;
  onOpenLevels: () => void;
  onOpenGarage: () => void;
  onOpenCompliance: () => void;
  onToggleMute: () => void;
  onResetProgress: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  progress,
  onStartGame,
  onOpenLevels,
  onOpenGarage,
  onOpenCompliance,
  onToggleMute,
  onResetProgress,
}) => {
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const telegramUser = telegram.getUser();

  const totalStars = Object.values(progress.levels).reduce((acc, l) => acc + l.stars, 0);
  const selectedLevel = ALL_LEVELS.find((l) => l.id === progress.selectedLevelId) || ALL_LEVELS[0];

  // Title-to-Start handshake: bind Enter and Space
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onStartGame();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onStartGame]);

  return (
    <div className="relative w-full h-full flex flex-col justify-between p-5 select-none bg-radial from-slate-900 via-slate-950 to-[#070a12] text-white">
      {/* Top Bar: Telegram Greeting & Stats */}
      <div className="flex items-center justify-between z-10">
        <div className="flex items-center gap-2 bg-slate-900/80 border border-slate-800 px-3 py-1.5 rounded-full shadow">
          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-xs font-mono font-medium text-slate-300">
            {telegramUser.isAvailable && telegramUser.firstName
              ? `Rider: ${telegramUser.firstName}`
              : 'Telegram Mini App'}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Coins */}
          <div className="flex items-center gap-1.5 bg-slate-900/80 border border-slate-800 px-3 py-1.5 rounded-full shadow text-amber-400 font-mono text-xs font-bold">
            <Coins className="w-3.5 h-3.5 fill-amber-400" />
            <span>{progress.totalCoins}</span>
          </div>

          {/* Stars */}
          <div className="flex items-center gap-1.5 bg-slate-900/80 border border-slate-800 px-3 py-1.5 rounded-full shadow text-amber-300 font-mono text-xs font-bold">
            <Trophy className="w-3.5 h-3.5" />
            <span>{totalStars}/60</span>
          </div>

          {/* Audio Mute Button */}
          <button
            onClick={() => {
              sound.playClick();
              onToggleMute();
            }}
            className="p-2 rounded-full bg-slate-900/80 border border-slate-800 text-slate-300 hover:text-white cursor-pointer"
            aria-label={progress.audioMuted ? 'Unmute Audio' : 'Mute Audio'}
          >
            {progress.audioMuted ? (
              <VolumeX className="w-4 h-4 text-rose-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-emerald-400" />
            )}
          </button>
        </div>
      </div>

      {/* Hero Showcase Centerpiece */}
      <div className="flex flex-col items-center justify-center text-center my-auto z-10 py-6">
        {/* Custom SVG Title Emblem */}
        <div className="relative mb-3">
          <svg className="w-64 h-24 sm:w-80 sm:h-28" viewBox="0 0 320 110" fill="none">
            {/* Speed Streak Lines Behind Title */}
            <path d="M10 30 L310 30" stroke="#06b6d4" strokeWidth="1" strokeDasharray="6 6" opacity="0.4" />
            <path d="M20 78 L300 78" stroke="#f43f5e" strokeWidth="1" strokeDasharray="8 4" opacity="0.3" />

            {/* Glowing Backdrop polygon */}
            <polygon points="25,12 295,12 315,96 5,96" fill="#090d16" stroke="#1e293b" strokeWidth="2" />
            <polygon points="27,14 293,14 312,94 8,94" fill="#0f172a" opacity="0.8" />

            {/* Title Text 'MOTO RUSH' */}
            <text
              x="160"
              y="54"
              textAnchor="middle"
              fontFamily="system-ui, -apple-system, sans-serif"
              fontSize="34"
              fontWeight="900"
              fontStyle="italic"
              letterSpacing="2"
              fill="#ffffff"
              stroke="#0f172a"
              strokeWidth="1.5"
            >
              MOTO RUSH
            </text>

            {/* Neon '20' Badge */}
            <g transform="translate(130, 64)">
              <rect x="0" y="0" width="60" height="24" rx="4" fill="#06b6d4" />
              <text
                x="30"
                y="17"
                textAnchor="middle"
                fontFamily="system-ui, sans-serif"
                fontSize="15"
                fontWeight="900"
                fill="#090d16"
                letterSpacing="1"
              >
                20 LVL
              </text>
            </g>
          </svg>
        </div>

        {/* Selected Level Capsule */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl px-4 py-2 flex items-center gap-3 mb-6 shadow-lg">
          <div className="text-left">
            <div className="text-[10px] font-mono uppercase text-cyan-400 font-bold">
              Current Mission
            </div>
            <div className="text-sm font-bold text-white">
              Level {selectedLevel.id}: {selectedLevel.title}
            </div>
          </div>
          <button
            onClick={() => {
              sound.playClick();
              onOpenLevels();
            }}
            className="text-xs text-slate-400 hover:text-cyan-300 underline font-mono cursor-pointer"
          >
            Change
          </button>
        </div>

        {/* Primary Start CTA */}
        <button
          onClick={() => {
            sound.playClick();
            onStartGame();
          }}
          data-start="true"
          className="w-full max-w-xs py-4 px-6 rounded-2xl bg-gradient-to-r from-cyan-500 via-sky-500 to-emerald-400 hover:from-cyan-400 hover:to-emerald-300 active:scale-95 transition-all text-slate-950 font-black text-lg tracking-wider uppercase flex items-center justify-center gap-2.5 shadow-xl shadow-cyan-500/25 cursor-pointer"
          aria-label="Start Game"
        >
          <Play className="w-6 h-6 fill-slate-950" />
          <span>Ride Now</span>
        </button>

        {/* Secondary Menu Buttons */}
        <div className="grid grid-cols-2 gap-2.5 w-full max-w-xs mt-3">
          <button
            onClick={() => {
              sound.playClick();
              onOpenLevels();
            }}
            className="py-3 px-3 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 active:scale-95 transition-all text-slate-200 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow"
          >
            <ListFilter className="w-4 h-4 text-cyan-400" />
            <span>20 Levels</span>
          </button>

          <button
            onClick={() => {
              sound.playClick();
              onOpenGarage();
            }}
            className="py-3 px-3 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 active:scale-95 transition-all text-slate-200 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow"
          >
            <Wrench className="w-4 h-4 text-amber-400" />
            <span>Garage</span>
          </button>
        </div>
      </div>

      {/* Footer & Controls Hint */}
      <div className="flex flex-col items-center gap-2 z-10 pt-2 border-t border-slate-900">
        <div className="flex items-center gap-4 text-xs">
          <button
            onClick={() => {
              sound.playClick();
              onOpenCompliance();
            }}
            className="text-[11px] text-slate-400 hover:text-cyan-400 flex items-center gap-1 cursor-pointer"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Adsgram & Policies</span>
          </button>

          <button
            onClick={() => setShowResetConfirm(true)}
            className="text-[11px] text-slate-500 hover:text-rose-400 flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Save</span>
          </button>
        </div>

        {/* Clean borderless control hint */}
        <div className="text-[10px] font-mono text-cyan-400/90 tracking-wide text-center">
          Swipe / Drag Screen to Steer &middot; A/D or Touch &middot; Space to Nitro &middot; P to Pause
        </div>
      </div>

      {/* Reset Confirmation Dialog */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90">
          <div className="w-full max-w-xs bg-slate-900 border border-slate-700 rounded-2xl p-4 text-center flex flex-col gap-3">
            <h3 className="text-base font-bold text-white">Reset Local Progress?</h3>
            <p className="text-xs text-slate-400">
              This will reset all unlocked levels, high scores, and coins stored in your browser.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 py-2 rounded-xl bg-slate-800 text-xs font-bold text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowResetConfirm(false);
                  onResetProgress();
                }}
                className="flex-1 py-2 rounded-xl bg-rose-600 text-xs font-bold text-white"
              >
                Confirm Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
