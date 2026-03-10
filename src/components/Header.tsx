import React from 'react';
import { Shield, Phone, Activity } from 'lucide-react';

interface HeaderProps {
  activeTab: 'nav' | 'safe' | 'shield';
  setActiveTab: (tab: 'nav' | 'safe' | 'shield') => void;
  triggerSOS: () => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab, triggerSOS }) => {
  return (
    <header className="border-b border-white/5 bg-black/50 backdrop-blur-xl z-50 shrink-0">
      <div className="max-w-[1600px] mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Shield className="w-5 h-5 text-black" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">SafePath</h1>
            <p className="text-[9px] uppercase tracking-widest text-emerald-500 font-bold opacity-80">Secure Routing Engine</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl border border-white/10">
          {(['nav', 'safe', 'shield'] as const).map((tab) => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
                activeTab === tab ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {tab === 'nav' ? 'Navigation' : tab === 'safe' ? 'Safe Zones' : 'Shield'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={triggerSOS}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-red-500/20"
          >
            <Phone className="w-3.5 h-3.5" />
            SOS
          </button>
          <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
            <Activity className="w-4 h-4 text-gray-400" />
          </div>
        </div>
      </div>
    </header>
  );
};
