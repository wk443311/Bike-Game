import React from 'react';
import { PlayerStats, LevelConfig } from '../types/game';
import { Volume2, VolumeX, Pause, Zap, Flame, ShieldAlert } from 'lucide-react';
import { formatDistance } from '../game/rules';

interface GameHUDProps {
  level: LevelConfig;
  stats: PlayerStats;
  isMuted: boolean;
  continueUsed: boolean;
  onToggleMute: () => void;
  onPause: () => void;
  onSteerLeft: (active: boolean) => void;
  onSteerRight: (active: boolean) => void;
  onBrake: (active: boolean) => void;
  onBoost: (active: boolean) => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  level,
  stats,
  isMuted,
  continueUsed,
  onToggleMute,
  onPause,
  onSteerLeft,
  onSteerRight,
  onBrake,
  onBoost,
}) => {
  const progressRatio = Math.min(1, stats.distance / level.targetDistance);
  const progressPercent = Math.round(progressRatio * 100);

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-3 select-none z-10">
      {/* Top Bar Perimeter Cluster */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between pointer-events-auto">
          {/* Level Info Pill */}
          <div className="bg-slate-900/90 border border-slate-700/80 px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-lg backdrop-blur-none">
            <span className="bg-cyan-500/20 text-cyan-400 font-mono font-bold text-xs px-1.5 py-0.5 rounded">
              LVL {level.id}
            </span>
            <div className="leading-tight">
              <div className="text-xs font-semibold text-white tracking-wide truncate max-w-[130px]">
                {level.title}
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                Goal: {formatDistance(level.targetDistance)}
              </div>
            </div>
          </div>

          {/* Controls: Audio & Pause */}
          <div className="flex items-center gap-2">
            <button
              onClick={onToggleMute}
              className="p-2 rounded-lg bg-slate-900/90 border border-slate-700/80 text-slate-300 hover:text-white active:scale-95 transition-all shadow-lg pointer-events-auto cursor-pointer"
              aria-label={isMuted ? 'Unmute Audio' : 'Mute Audio'}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
            </button>
            <button
              onClick={onPause}
              className="p-2 rounded-lg bg-slate-900/90 border border-slate-700/80 text-slate-300 hover:text-white active:scale-95 transition-all shadow-lg pointer-events-auto cursor-pointer"
              aria-label="Pause Game"
            >
              <Pause className="w-4 h-4 text-amber-400" />
            </button>
          </div>
        </div>

        {/* Distance Progress Bar */}
        <div className="bg-slate-900/90 border border-slate-700/80 p-2 rounded-lg shadow-lg">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-300 mb-1">
            <span className="flex items-center gap-1 font-bold text-cyan-400">
              <Zap className="w-3 h-3 text-cyan-400" /> {formatDistance(stats.distance)}
            </span>
            <span className="text-slate-400 font-bold">{progressPercent}%</span>
            <span className="text-slate-400">{formatDistance(level.targetDistance)}</span>
          </div>
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 rounded-full transition-all duration-100"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Speedometer & Score Dashboard */}
        <div className="flex items-center justify-between">
          {/* Speedometer */}
          <div className="bg-slate-900/90 border border-slate-700/80 px-3 py-1.5 rounded-lg shadow-lg flex items-baseline gap-1.5">
            <span className="text-2xl font-black font-mono tracking-tighter tabular-nums text-white">
              {stats.speedKmh}
            </span>
            <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">KM/H</span>
          </div>

          {/* Near-Miss & Score */}
          <div className="bg-slate-900/90 border border-slate-700/80 px-3 py-1.5 rounded-lg shadow-lg flex items-center gap-3">
            <div className="text-right">
              <div className="text-[9px] uppercase font-bold text-amber-400 tracking-wider">Near Miss</div>
              <div className="text-base font-black font-mono text-amber-300 tabular-nums leading-none">
                {stats.nearMisses}
              </div>
            </div>
            <div className="h-6 w-px bg-slate-700" />
            <div className="text-right">
              <div className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Score</div>
              <div className="text-base font-black font-mono text-white tabular-nums leading-none">
                {stats.score}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Area: Nitro Bar & Mobile Touch Controls */}
      <div className="flex flex-col gap-2 pointer-events-auto">
        {/* Nitro Meter */}
        <div className="bg-slate-900/90 border border-slate-700/80 p-1.5 rounded-lg shadow-lg">
          <div className="flex items-center justify-between text-[10px] font-mono text-cyan-400 mb-1 px-1">
            <span className="flex items-center gap-1 font-bold">
              <Flame className="w-3 h-3 text-cyan-400 fill-cyan-400" /> NITRO BOOST
            </span>
            <span className="font-bold text-white">{stats.nitroPercent}%</span>
          </div>
          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 via-cyan-400 to-sky-300 transition-all duration-75"
              style={{ width: `${stats.nitroPercent}%` }}
            />
          </div>
        </div>

        {/* Mobile On-Screen Touch Controls */}
        <div className="grid grid-cols-4 gap-2 pt-1 pb-2">
          {/* Steer Left */}
          <button
            onPointerDown={() => onSteerLeft(true)}
            onPointerUp={() => onSteerLeft(false)}
            onPointerLeave={() => onSteerLeft(false)}
            onTouchCancel={() => onSteerLeft(false)}
            className="h-14 rounded-xl bg-slate-900/90 active:bg-cyan-600/40 border border-slate-700/80 text-cyan-400 active:text-white flex flex-col items-center justify-center font-black text-xl shadow-lg active:scale-95 transition-all select-none touch-none cursor-pointer"
            aria-label="Steer Left"
          >
            <span>&larr;</span>
            <span className="text-[9px] font-mono font-normal tracking-wide text-slate-400">LEFT</span>
          </button>

          {/* Steer Right */}
          <button
            onPointerDown={() => onSteerRight(true)}
            onPointerUp={() => onSteerRight(false)}
            onPointerLeave={() => onSteerRight(false)}
            onTouchCancel={() => onSteerRight(false)}
            className="h-14 rounded-xl bg-slate-900/90 active:bg-cyan-600/40 border border-slate-700/80 text-cyan-400 active:text-white flex flex-col items-center justify-center font-black text-xl shadow-lg active:scale-95 transition-all select-none touch-none cursor-pointer"
            aria-label="Steer Right"
          >
            <span>&rarr;</span>
            <span className="text-[9px] font-mono font-normal tracking-wide text-slate-400">RIGHT</span>
          </button>

          {/* Brake Pedal */}
          <button
            onPointerDown={() => onBrake(true)}
            onPointerUp={() => onBrake(false)}
            onPointerLeave={() => onBrake(false)}
            onTouchCancel={() => onBrake(false)}
            className="h-14 rounded-xl bg-rose-950/60 active:bg-rose-600/60 border border-rose-800/80 text-rose-300 active:text-white flex flex-col items-center justify-center font-bold text-sm shadow-lg active:scale-95 transition-all select-none touch-none cursor-pointer"
            aria-label="Brake"
          >
            <ShieldAlert className="w-5 h-5 mb-0.5" />
            <span className="text-[9px] font-mono font-normal tracking-wide">BRAKE</span>
          </button>

          {/* Nitro Boost Button */}
          <button
            onPointerDown={() => onBoost(true)}
            onPointerUp={() => onBoost(false)}
            onPointerLeave={() => onBoost(false)}
            onTouchCancel={() => onBoost(false)}
            className="h-14 rounded-xl bg-cyan-950/70 active:bg-cyan-500/60 border border-cyan-500/80 text-cyan-300 active:text-white flex flex-col items-center justify-center font-bold text-sm shadow-lg active:scale-95 transition-all select-none touch-none cursor-pointer"
            aria-label="Boost Nitro"
          >
            <Flame className="w-5 h-5 mb-0.5 fill-current text-cyan-400" />
            <span className="text-[9px] font-mono font-normal tracking-wide">NITRO</span>
          </button>
        </div>

        {/* Controls Hint */}
        <div className="text-center text-[10px] font-mono text-cyan-400/90 pb-1 flex items-center justify-center gap-1">
          <span>&larr; Swipe / Drag Screen to Steer &rarr;</span>
          <span className="hidden sm:inline text-slate-500">&middot; [A/D or Arrows] &middot; [Space] Nitro &middot; [P] Pause</span>
        </div>
      </div>
    </div>
  );
};
