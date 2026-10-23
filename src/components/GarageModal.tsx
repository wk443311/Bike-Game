import React, { useState } from 'react';
import { ALL_BIKES } from '../game/levels';
import { UserProgress, BikeModel } from '../types/game';
import { ArrowLeft, Check, Lock, Coins, Gauge, Zap, Compass, Flame } from 'lucide-react';
import { sound } from '../services/audio';

interface GarageModalProps {
  progress: UserProgress;
  onSelectBike: (bikeId: string) => void;
  onBuyBike: (bikeId: string, cost: number) => void;
  onClose: () => void;
}

export const GarageModal: React.FC<GarageModalProps> = ({
  progress,
  onSelectBike,
  onBuyBike,
  onClose,
}) => {
  const [activeBikeId, setActiveBikeId] = useState<string>(progress.selectedBikeId);
  const activeBike = ALL_BIKES.find((b) => b.id === activeBikeId) || ALL_BIKES[0];

  const isUnlocked = progress.unlockedBikes.includes(activeBike.id);
  const isEquipped = progress.selectedBikeId === activeBike.id;
  const canAfford = progress.totalCoins >= activeBike.price;

  const handleEquip = () => {
    sound.playClick();
    onSelectBike(activeBike.id);
  };

  const handleBuy = () => {
    if (canAfford) {
      sound.playClick();
      onBuyBike(activeBike.id, activeBike.price);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/90 select-none">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-4 flex flex-col gap-3 my-auto animate-in fade-in zoom-in-95 duration-150">
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
                Motorcycle Garage
              </h2>
              <p className="text-[10px] text-slate-400 font-mono">
                Select or tune your racing machine
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 text-amber-400 text-xs font-mono font-bold">
            <Coins className="w-3.5 h-3.5 fill-amber-400" />
            <span>{progress.totalCoins}</span>
          </div>
        </div>

        {/* Bike Selector Carousel Tabs */}
        <div className="grid grid-cols-4 gap-2">
          {ALL_BIKES.map((bike) => {
            const unlocked = progress.unlockedBikes.includes(bike.id);
            const isCurrent = activeBikeId === bike.id;
            const equipped = progress.selectedBikeId === bike.id;

            return (
              <button
                key={bike.id}
                onClick={() => {
                  sound.playClick();
                  setActiveBikeId(bike.id);
                }}
                className={`p-2 rounded-xl border text-center flex flex-col items-center gap-1 transition-all cursor-pointer ${
                  isCurrent
                    ? 'bg-slate-800 border-cyan-400 shadow-lg'
                    : 'bg-slate-950/50 border-slate-800 hover:border-slate-700'
                }`}
                aria-label={bike.name}
              >
                <div
                  className="w-4 h-4 rounded-full border border-white/40 shadow-sm"
                  style={{ backgroundColor: bike.color }}
                />
                <div className="text-[10px] font-bold text-white truncate w-full">
                  {bike.name.split(' ')[0]}
                </div>
                {equipped ? (
                  <span className="text-[8px] bg-cyan-500/20 text-cyan-400 font-mono px-1 rounded">
                    ON
                  </span>
                ) : !unlocked ? (
                  <Lock className="w-2.5 h-2.5 text-slate-500" />
                ) : (
                  <span className="text-[8px] text-slate-400 font-mono">Ready</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Showcase Area */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 flex flex-col items-center gap-3">
          <div className="text-center">
            <div className="text-xs font-mono uppercase tracking-wider text-cyan-400">
              {activeBike.type}
            </div>
            <h3 className="text-xl font-black text-white">{activeBike.name}</h3>
            <p className="text-xs text-slate-400 max-w-xs mt-1 leading-relaxed">
              {activeBike.description}
            </p>
          </div>

          {/* Performance Specs */}
          <div className="w-full grid grid-cols-2 gap-2 text-xs font-mono">
            {/* Speed */}
            <div className="p-2 bg-slate-900/60 rounded-lg border border-slate-800/80">
              <div className="flex justify-between text-slate-400 text-[10px] mb-1">
                <span className="flex items-center gap-1">
                  <Gauge className="w-3 h-3 text-cyan-400" /> Top Speed
                </span>
                <span className="font-bold text-white">{activeBike.maxSpeedKmh} KM/H</span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-cyan-400 rounded-full"
                  style={{ width: `${(activeBike.maxSpeedKmh / 220) * 100}%` }}
                />
              </div>
            </div>

            {/* Acceleration */}
            <div className="p-2 bg-slate-900/60 rounded-lg border border-slate-800/80">
              <div className="flex justify-between text-slate-400 text-[10px] mb-1">
                <span className="flex items-center gap-1">
                  <Zap className="w-3 h-3 text-amber-400" /> Acceleration
                </span>
                <span className="font-bold text-white">{activeBike.acceleration}</span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-400 rounded-full"
                  style={{ width: `${activeBike.acceleration}%` }}
                />
              </div>
            </div>

            {/* Handling */}
            <div className="p-2 bg-slate-900/60 rounded-lg border border-slate-800/80">
              <div className="flex justify-between text-slate-400 text-[10px] mb-1">
                <span className="flex items-center gap-1">
                  <Compass className="w-3 h-3 text-emerald-400" /> Handling
                </span>
                <span className="font-bold text-white">{activeBike.handling}</span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-400 rounded-full"
                  style={{ width: `${activeBike.handling}%` }}
                />
              </div>
            </div>

            {/* Nitro */}
            <div className="p-2 bg-slate-900/60 rounded-lg border border-slate-800/80">
              <div className="flex justify-between text-slate-400 text-[10px] mb-1">
                <span className="flex items-center gap-1">
                  <Flame className="w-3 h-3 text-rose-400" /> Nitro Capacity
                </span>
                <span className="font-bold text-white">{activeBike.nitroCapacity}</span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-rose-400 rounded-full"
                  style={{ width: `${(activeBike.nitroCapacity / 120) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div>
          {isEquipped ? (
            <div className="w-full py-3 rounded-xl bg-slate-800/80 text-emerald-400 font-bold text-sm flex items-center justify-center gap-2 border border-emerald-500/30">
              <Check className="w-4 h-4" />
              <span>Currently Equipped</span>
            </div>
          ) : isUnlocked ? (
            <button
              onClick={handleEquip}
              className="w-full py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 active:scale-[0.98] transition-all text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/40 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Equip This Bike</span>
            </button>
          ) : (
            <button
              onClick={handleBuy}
              disabled={!canAfford}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 active:scale-[0.98] transition-all text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-950/40 disabled:opacity-50 cursor-pointer"
            >
              <Coins className="w-4 h-4 fill-slate-950" />
              <span>Unlock for {activeBike.price} Coins {!canAfford && '(Need more coins)'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
