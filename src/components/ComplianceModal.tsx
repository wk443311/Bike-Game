import React from 'react';
import { ArrowLeft, CheckCircle2, ShieldCheck, Film, AlertCircle } from 'lucide-react';
import { ADSGRAM_BLOCK_ID } from '../services/adsgram';

interface ComplianceModalProps {
  onClose: () => void;
}

export const ComplianceModal: React.FC<ComplianceModalProps> = ({ onClose }) => {
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
              <h2 className="text-base font-black text-white uppercase tracking-wider">
                Adsgram & Policy Compliance
              </h2>
              <p className="text-[10px] text-slate-400 font-mono">
                Mandatory Policy & Integrity Verification
              </p>
            </div>
          </div>
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
            <ShieldCheck className="w-4 h-4" />
          </div>
        </div>

        {/* Configuration Overview */}
        <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 flex flex-col gap-1.5 text-xs font-mono">
          <div className="text-slate-400 text-[11px] font-bold uppercase tracking-wider">
            Placement Configuration
          </div>
          <div className="flex justify-between items-center py-1 border-b border-slate-800/80">
            <span className="text-slate-400">Adsgram SDK Script:</span>
            <span className="text-emerald-400 font-bold">Loaded (sad.min.js)</span>
          </div>
          <div className="flex justify-between items-center py-1 border-b border-slate-800/80">
            <span className="text-slate-400">Ad Format:</span>
            <span className="text-cyan-400 font-bold">Rewarded Video (Optional)</span>
          </div>
          <div className="flex justify-between items-center py-1 border-b border-slate-800/80">
            <span className="text-slate-400">Configured Block ID:</span>
            <span className="text-amber-400 font-mono text-[11px] truncate max-w-[160px]">
              {ADSGRAM_BLOCK_ID}
            </span>
          </div>
          <div className="flex justify-between items-center py-1">
            <span className="text-slate-400">Single Continue Limit:</span>
            <span className="text-emerald-400 font-bold">Enforced (1 / attempt)</span>
          </div>
        </div>

        {/* Compliance Checklist Items */}
        <div className="space-y-2 text-xs overflow-y-auto max-h-[45vh] pr-1">
          <div className="p-2.5 rounded-xl bg-slate-950/50 border border-slate-800/80 flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-white">Voluntary User-Initiated Opt-In</div>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                Advertisements are ONLY shown when the player explicitly clicks "Watch Ad & Continue" on the Game Over screen. Ads are never auto-launched.
              </p>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-950/50 border border-slate-800/80 flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-white">Zero Forced Ads & Instant Free Restart</div>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                Players can play all 20 levels, complete objectives, and restart immediately without ever viewing an ad. Core gameplay is never paywalled.
              </p>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-950/50 border border-slate-800/80 flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-white">Strict Verified Reward Fulfillment</div>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                Rewards are granted strictly after Adsgram's official completion signal (<code className="text-cyan-300">result.done === true</code>). Early closes or skips grant zero reward.
              </p>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-950/50 border border-slate-800/80 flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-white">Anti-Exploit Protection & Spawn Shield</div>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                Upon verified continue, the player receives a 3.5s invulnerability shield and nearby vehicles are cleared to prevent repeat collision traps.
              </p>
            </div>
          </div>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs cursor-pointer"
        >
          Close Inspector
        </button>
      </div>
    </div>
  );
};
