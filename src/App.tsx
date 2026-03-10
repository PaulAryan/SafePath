import React, { useState, useEffect, useRef } from 'react';
import { Search, AlertTriangle, Navigation, MapPin, Zap, Shield } from 'lucide-react';
import MapView from './components/MapView';
import { Incident, SafeZone } from './types';
import { motion, AnimatePresence } from 'motion/react';
import { Header } from './components/Header';
import { SOSModal } from './components/SOSModal';
import { IncidentModal } from './components/IncidentModal';
import { DigitalShield } from './components/DigitalShield';
import { SafeZonesList } from './components/SafeZonesList';
import { RouteResults } from './components/RouteResults';
import { generateSafetyBriefing } from './services/geminiService';
import { DEFAULT_CENTER } from './constants';

interface Suggestion {
  display_name: string;
  lat: string;
  lon: string;
  place_id: number;
}

export default function App() {
  const [source, setSource] = useState('Your Current Position');
  const [sourceCoords, setSourceCoords] = useState<[number, number] | null>(null);
  const [destination, setDestination] = useState('');
  const [destCoords, setDestCoords] = useState<[number, number] | null>(null);
  
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [activeSearch, setActiveSearch] = useState<'source' | 'dest' | null>(null);
  
  const [currentPos, setCurrentPos] = useState<[number, number]>(DEFAULT_CENTER);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [safeZones, setSafeZones] = useState<SafeZone[]>([]);
  const [routeSafeZones, setRouteSafeZones] = useState<SafeZone[]>([]);
  const [route, setRoute] = useState<[number, number][] | undefined>();
  const [routeDetails, setRouteDetails] = useState<{ distance: number; duration: number } | null>(null);
  const [safetyScore, setSafetyScore] = useState<number | null>(null);
  const [safetyMetrics, setSafetyMetrics] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [activeTab, setActiveTab] = useState<'nav' | 'safe' | 'shield'>('nav');
  const [isVoiceMonitorActive, setIsVoiceMonitorActive] = useState(false);
  const [isDigitalShieldActive, setIsDigitalShieldActive] = useState(true);
  const [focusedLocation, setFocusedLocation] = useState<[number, number] | null>(null);
  
  const [isReporting, setIsReporting] = useState(false);
  const [reportData, setReportData] = useState({ type: '', severity: 5 });
  const [isSOSActive, setIsSOSActive] = useState(false);
  const [sosCountdown, setSosCountdown] = useState(5);
  const [safetyBriefing, setSafetyBriefing] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const searchRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/incidents').then(res => res.json()),
      fetch('/api/safe-zones').then(res => res.json())
    ]).then(([incidentsData, safeZonesData]) => {
      setIncidents(incidentsData);
      setSafeZones(safeZonesData);
    });

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        const coords: [number, number] = [position.coords.latitude, position.coords.longitude];
        setCurrentPos(coords);
        setSourceCoords(coords);
      });
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setActiveSearch(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const query = activeSearch === 'source' ? source : destination;
    if (query === 'Your Current Position') return;

    const delayDebounceFn = setTimeout(async () => {
      if (query.length > 2) {
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`);
          const data = await res.json();
          setSuggestions(data);
        } catch (err) {
          console.error("Autocomplete failed:", err);
        }
      } else {
        setSuggestions([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [source, destination, activeSearch]);

  useEffect(() => {
    if (isVoiceMonitorActive) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = true;
        recognitionRef.current.interimResults = true;
        
        recognitionRef.current.onresult = (event: any) => {
          const transcript = Array.from(event.results)
            .map((result: any) => result[0].transcript)
            .join('')
            .toLowerCase();
          
          if (transcript.includes('help') || transcript.includes('emergency') || transcript.includes('sos')) {
            triggerSOS();
            setIsVoiceMonitorActive(false);
          }
        };
        recognitionRef.current.start();
      }
    } else if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    return () => recognitionRef.current?.stop();
  }, [isVoiceMonitorActive]);

  const selectSuggestion = (suggestion: Suggestion) => {
    const coords: [number, number] = [parseFloat(suggestion.lat), parseFloat(suggestion.lon)];
    if (activeSearch === 'source') {
      setSource(suggestion.display_name);
      setSourceCoords(coords);
    } else {
      setDestination(suggestion.display_name);
      setDestCoords(coords);
    }
    setActiveSearch(null);
    setSuggestions([]);
  };

  const handleCalculateRoute = async () => {
    if (!sourceCoords || !destCoords) return;
    setIsSearching(true);
    setSafetyBriefing(null);
    try {
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${sourceCoords[1]},${sourceCoords[0]};${destCoords[1]},${destCoords[0]}?overview=full&geometries=geojson&alternatives=true`;
      const routeRes = await fetch(osrmUrl);
      const routeData = await routeRes.json();

      if (routeData.routes && routeData.routes.length > 0) {
        const routesWithScores = await Promise.all(routeData.routes.map(async (r: any) => {
          const coords = r.geometry.coordinates.map((c: any) => [c[1], c[0]]);
          const scoreRes = await fetch('/api/score-route', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ coordinates: coords })
          });
          const data = await scoreRes.json();
          return { route: r, coords, safetyScore: data.safetyScore, metrics: data.metrics, nearbySafeZones: data.nearbySafeZones };
        }));

        routesWithScores.sort((a, b) => b.safetyScore - a.safetyScore);
        const best = routesWithScores[0];
        setRoute(best.coords);
        setSafetyScore(best.safetyScore);
        setSafetyMetrics(best.metrics);
        setRouteSafeZones(best.nearbySafeZones || []);
        setRouteDetails({ distance: best.route.distance, duration: best.route.duration });
        setActiveTab('nav');
      }
    } catch (error) {
      console.error("Routing failed:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleGenerateBriefing = async () => {
    if (!routeDetails || !safetyMetrics || safetyScore === null) return;
    setIsAnalyzing(true);
    try {
      const briefing = await generateSafetyBriefing(safetyScore, safetyMetrics, routeDetails.distance, routeDetails.duration);
      setSafetyBriefing(briefing);
    } catch (error: any) {
      setSafetyBriefing(error.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const submitReport = async () => {
    if (!reportData.type) return;
    await fetch('/api/incidents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lat: currentPos[0] + (Math.random() - 0.5) * 0.005,
        lng: currentPos[1] + (Math.random() - 0.5) * 0.005,
        type: reportData.type,
        severity: reportData.severity
      })
    });
    const res = await fetch('/api/incidents');
    setIncidents(await res.json());
    setIsReporting(false);
    setReportData({ type: '', severity: 5 });
  };

  const triggerSOS = () => {
    setIsSOSActive(true);
    setSosCountdown(5);
    const timer = setInterval(() => {
      setSosCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-emerald-500/30 overflow-hidden flex flex-col">
      <Header activeTab={activeTab} setActiveTab={setActiveTab} triggerSOS={triggerSOS} />

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-[400px] border-r border-white/5 bg-black/40 backdrop-blur-md overflow-y-auto p-6 space-y-6 hidden lg:block shrink-0">
          {activeTab === 'nav' ? (
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 flex items-center gap-2">
                  <Navigation className="w-3 h-3" />
                  Route Planner
                </h2>
                <span className="text-[10px] text-emerald-500 font-mono">GPS: ACTIVE</span>
              </div>
              
              <div className="space-y-3" ref={searchRef}>
                <div className="relative group">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-emerald-500 transition-colors" />
                  <input 
                    type="text" 
                    placeholder="Source Location" 
                    value={source}
                    onChange={(e) => { setSource(e.target.value); setActiveSearch('source'); }}
                    onFocus={() => setActiveSearch('source')}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-xs focus:outline-none focus:border-emerald-500/50 transition-all text-white"
                  />
                  {source !== 'Your Current Position' && (
                    <button 
                      onClick={() => { setSource('Your Current Position'); setSourceCoords(currentPos); }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-bold text-emerald-500 hover:text-emerald-400"
                    >
                      USE GPS
                    </button>
                  )}
                </div>
                
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                  <input 
                    type="text" 
                    placeholder="Search destination..." 
                    value={destination}
                    onChange={(e) => { setDestination(e.target.value); setActiveSearch('dest'); }}
                    onFocus={() => setActiveSearch('dest')}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-xs focus:outline-none focus:border-emerald-500/50 transition-all placeholder:text-gray-600 text-white"
                  />
                  <AnimatePresence>
                    {activeSearch && suggestions.length > 0 && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                        className="absolute top-full left-0 right-0 mt-2 bg-[#121212] border border-white/10 rounded-xl overflow-hidden z-[60] shadow-2xl"
                      >
                        {suggestions.map((s) => (
                          <button
                            key={s.place_id} onClick={() => selectSuggestion(s)}
                            className="w-full text-left px-4 py-3 text-[11px] hover:bg-white/5 border-b border-white/5 last:border-0 transition-colors flex items-start gap-3"
                          >
                            <MapPin className="w-3.5 h-3.5 mt-0.5 text-gray-500 shrink-0" />
                            <span className="truncate text-gray-300">{s.display_name}</span>
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <button 
                  onClick={handleCalculateRoute} disabled={isSearching || !destCoords}
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3 rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/10 disabled:opacity-50"
                >
                  {isSearching ? "Calculating..." : "Analyze Safest Route"}
                </button>
              </div>
            </section>
          ) : activeTab === 'safe' ? (
            <SafeZonesList safeZones={safeZones} onFocus={(loc) => setFocusedLocation(loc)} />
          ) : (
            <DigitalShield 
              isVoiceMonitorActive={isVoiceMonitorActive} setIsVoiceMonitorActive={setIsVoiceMonitorActive}
              isDigitalShieldActive={isDigitalShieldActive} setIsDigitalShieldActive={setIsDigitalShieldActive}
            />
          )}

          <AnimatePresence mode="wait">
            {isSearching ? (
              <motion.div 
                key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="py-12 flex flex-col items-center justify-center gap-4 text-center"
              >
                <div className="w-12 h-12 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
                <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">Analyzing Safety Vectors...</p>
              </motion.div>
            ) : safetyScore !== null && routeDetails && activeTab === 'nav' ? (
              <RouteResults 
                safetyScore={safetyScore} routeDetails={routeDetails} safetyMetrics={safetyMetrics}
                routeSafeZones={routeSafeZones} safetyBriefing={safetyBriefing} isAnalyzing={isAnalyzing}
                onGenerateBriefing={handleGenerateBriefing} onFocus={(loc) => setFocusedLocation(loc)}
              />
            ) : null}
          </AnimatePresence>

          <div className="pt-6 border-t border-white/5">
            <button 
              onClick={() => setIsReporting(true)}
              className="w-full border border-white/10 hover:bg-white/5 text-gray-400 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />
              Report Safety Concern
            </button>
          </div>
        </aside>

        <main className="flex-1 relative">
          <MapView 
            center={currentPos} zoom={14} route={route} incidents={incidents} 
            safeZones={activeTab === 'safe' ? safeZones : (route ? routeSafeZones : safeZones)}
            highlightSafeZones={activeTab === 'safe'} focusLocation={focusedLocation}
          />
          
          <div className="absolute bottom-8 right-8 flex flex-col gap-3 pointer-events-none z-[1000]">
            <motion.div 
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl p-4 w-48 pointer-events-auto shadow-2xl"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center">
                  <Zap className="w-4 h-4 text-blue-500" />
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-widest text-gray-500 font-bold">Live Incidents</p>
                  <p className="text-sm font-bold text-white">{incidents.length} Active</p>
                </div>
              </div>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}
              className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl p-4 w-48 pointer-events-auto shadow-2xl"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                  <Shield className="w-4 h-4 text-emerald-500" />
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-widest text-gray-500 font-bold">Safe Zones</p>
                  <p className="text-sm font-bold text-white">{safeZones.length} Nearby</p>
                </div>
              </div>
            </motion.div>
          </div>
        </main>
      </div>

      <IncidentModal 
        isOpen={isReporting} onClose={() => setIsReporting(false)} 
        reportData={reportData} setReportData={setReportData} onSubmit={submitReport} 
      />
      <SOSModal isOpen={isSOSActive} countdown={sosCountdown} onCancel={() => setIsSOSActive(false)} />
    </div>
  );
}
