import React from 'react';
import { motion } from 'motion/react';
import { Shield, Zap, MessageSquare, ShieldCheck, Loader2, MapPin, ArrowRight } from 'lucide-react';
import { SafeZone } from '../types';

interface RouteResultsProps {
  safetyScore: number;
  routeDetails: { distance: number; duration: number };
  safetyMetrics: any;
  routeSafeZones: SafeZone[];
  safetyBriefing: string | null;
  isAnalyzing: boolean;
  onGenerateBriefing: () => void;
  onFocus: (location: [number, number]) => void;
}

export const RouteResults: React.FC<RouteResultsProps> = ({
  safetyScore,
  routeDetails,
  safetyMetrics,
  routeSafeZones,
  safetyBriefing,
  isAnalyzing,
  onGenerateBriefing,
  onFocus
}) => {
  return (
    <motion.div 
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-6"
    >
      <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <Shield className="w-16 h-16 text-emerald-500" />
        </div>
        
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-emerald-500">Safety Index</h3>
          <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-500">
            <Zap className="w-3 h-3" />
            {safetyScore > 85 ? 'OPTIMAL' : safetyScore > 70 ? 'SECURE' : 'CAUTION'}
          </div>
        </div>

        <div className="flex items-baseline gap-2 mb-6">
          <span className={`text-5xl font-light tracking-tighter ${safetyScore > 85 ? 'text-white' : safetyScore > 70 ? 'text-emerald-400' : 'text-orange-400'}`}>{safetyScore}</span>
          <span className="text-xs text-emerald-500/60 font-medium">/ 100</span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-[9px] uppercase tracking-widest text-gray-500 font-bold">Distance</p>
            <p className="text-sm font-medium text-white">{(routeDetails.distance / 1000).toFixed(1)} km</p>
          </div>
          <div className="space-y-1">
            <p className="text-[9px] uppercase tracking-widest text-gray-500 font-bold">Duration</p>
            <p className="text-sm font-medium text-white">{Math.round(routeDetails.duration / 60)} mins</p>
          </div>
        </div>

        <div className="pt-4 border-t border-emerald-500/10">
          {!safetyBriefing ? (
            <button 
              onClick={onGenerateBriefing}
              disabled={isAnalyzing}
              className="w-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <MessageSquare className="w-3 h-3" />
                  Get AI Safety Briefing
                </>
              )}
            </button>
          ) : (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="bg-emerald-500/10 rounded-xl p-3"
            >
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="w-3 h-3 text-emerald-500" />
                <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest">AI Safety Briefing</span>
              </div>
              <p className="text-[11px] text-gray-300 leading-relaxed italic">"{safetyBriefing}"</p>
            </motion.div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Safety Vectors</h3>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-4">
          {[
            { label: 'Crime Safety', value: safetyMetrics?.crimeSafety },
            { label: 'Lighting', value: safetyMetrics?.lighting },
            { label: 'Crowd Density', value: safetyMetrics?.crowdDensity },
            { label: 'Infrastructure', value: safetyMetrics?.infrastructure }
          ].map(metric => (
            <div key={metric.label} className="space-y-2">
              <div className="flex justify-between text-[10px]">
                <span className="text-gray-400">{metric.label}</span>
                <span className="text-emerald-500">{metric.value}%</span>
              </div>
              <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${metric.value}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {routeSafeZones.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 flex items-center gap-2">
            <Shield className="w-3 h-3" />
            Safe Havens Along Route
          </h3>
          <div className="space-y-2">
            {routeSafeZones.map(zone => (
              <div 
                key={`route-zone-${zone.id}`} 
                onClick={() => onFocus([zone.lat, zone.lng])}
                className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-3 flex items-center justify-between cursor-pointer hover:bg-emerald-500/10 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-1.5 h-1.5 rounded-full ${zone.type === 'police' ? 'bg-blue-500' : zone.type === 'hospital' ? 'bg-red-500' : 'bg-emerald-500'}`} />
                  <div>
                    <p className="text-[11px] font-bold text-white">{zone.name}</p>
                    <p className="text-[9px] text-gray-500 uppercase tracking-wider">{zone.type.replace('_', ' ')}</p>
                  </div>
                </div>
                <MapPin className="w-3 h-3 text-emerald-500/50" />
              </div>
            ))}
          </div>
        </div>
      )}

      <button className="w-full bg-white text-black font-bold py-3.5 rounded-xl text-xs flex items-center justify-center gap-2 hover:bg-gray-200 transition-colors">
        Start Secure Navigation
        <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
};
