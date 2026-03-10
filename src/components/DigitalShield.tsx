import React from 'react';
import { motion } from 'motion/react';
import { Shield, Activity, Zap } from 'lucide-react';

interface DigitalShieldProps {
  isVoiceMonitorActive: boolean;
  setIsVoiceMonitorActive: (active: boolean) => void;
  isDigitalShieldActive: boolean;
  setIsDigitalShieldActive: (active: boolean) => void;
}

export const DigitalShield: React.FC<DigitalShieldProps> = ({
  isVoiceMonitorActive,
  setIsVoiceMonitorActive,
  isDigitalShieldActive,
  setIsDigitalShieldActive
}) => {
  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 flex items-center gap-2">
          <Shield className="w-3 h-3" />
          Digital & Voice Shield
        </h2>
      </div>

      <div className="space-y-4">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isVoiceMonitorActive ? 'bg-emerald-500/10' : 'bg-white/5'}`}>
                <Activity className={`w-5 h-5 ${isVoiceMonitorActive ? 'text-emerald-500' : 'text-gray-500'}`} />
              </div>
              <div>
                <p className="text-xs font-bold text-white">Voice Monitor</p>
                <p className="text-[10px] text-gray-500">Listening for 'Help' or Screams</p>
              </div>
            </div>
            <button 
              onClick={() => setIsVoiceMonitorActive(!isVoiceMonitorActive)}
              className={`w-12 h-6 rounded-full transition-colors relative ${isVoiceMonitorActive ? 'bg-emerald-500' : 'bg-white/10'}`}
            >
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isVoiceMonitorActive ? 'left-7' : 'left-1'}`} />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDigitalShieldActive ? 'bg-blue-500/10' : 'bg-white/5'}`}>
                <Shield className={`w-5 h-5 ${isDigitalShieldActive ? 'text-blue-500' : 'text-gray-500'}`} />
              </div>
              <div>
                <p className="text-xs font-bold text-white">Digital Protection</p>
                <p className="text-[10px] text-gray-500">Scanning for Personal Leaks</p>
              </div>
            </div>
            <button 
              onClick={() => setIsDigitalShieldActive(!isDigitalShieldActive)}
              className={`w-12 h-6 rounded-full transition-colors relative ${isDigitalShieldActive ? 'bg-blue-500' : 'bg-white/10'}`}
            >
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isDigitalShieldActive ? 'left-7' : 'left-1'}`} />
            </button>
          </div>
        </div>

        {isDigitalShieldActive && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 relative overflow-hidden"
          >
            <motion.div 
              animate={{ x: ['-100%', '200%'] }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              className="absolute top-0 bottom-0 w-1/2 bg-gradient-to-r from-transparent via-blue-500/10 to-transparent skew-x-12"
            />
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-3 h-3 text-blue-500" />
              <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">Live Scan Result</p>
            </div>
            <p className="text-[11px] text-gray-300 italic">"No unauthorized personal data or photos detected on major public databases."</p>
          </motion.div>
        )}
      </div>
    </section>
  );
};
