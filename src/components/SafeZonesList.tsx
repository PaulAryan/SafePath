import React from 'react';
import { Shield, ChevronRight } from 'lucide-react';
import { SafeZone } from '../types';

interface SafeZonesListProps {
  safeZones: SafeZone[];
  onFocus: (location: [number, number]) => void;
}

export const SafeZonesList: React.FC<SafeZonesListProps> = ({ safeZones, onFocus }) => {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 flex items-center gap-2">
          <Shield className="w-3 h-3" />
          Nearby Safe Zones
        </h2>
      </div>
      
      <div className="space-y-3">
        {safeZones.map(zone => (
          <div 
            key={zone.id} 
            onClick={() => onFocus([zone.lat, zone.lng])}
            className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-colors cursor-pointer group"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${zone.type === 'police' ? 'bg-blue-500' : zone.type === 'hospital' ? 'bg-red-500' : 'bg-emerald-500'}`} />
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{zone.type.replace('_', ' ')}</span>
              </div>
              <ChevronRight className="w-3 h-3 text-gray-600 group-hover:text-white transition-colors" />
            </div>
            <p className="text-xs font-bold text-white">{zone.name}</p>
            <p className="text-[10px] text-gray-500 mt-1">Verified Safe Haven • 24/7 Access</p>
          </div>
        ))}
      </div>
    </section>
  );
};
