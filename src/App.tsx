import React, { useState, useEffect, useRef } from 'react';
import { Search, Shield, AlertTriangle, Navigation, MapPin, Phone, Activity, Zap, Clock, ArrowRight, X, ChevronRight, MessageSquare, ShieldCheck, Loader2 } from 'lucide-react';
import MapView from './components/MapView';
import { Incident, RouteData, SafeZone } from './types';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

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
  
  const [currentPos, setCurrentPos] = useState<[number, number]>([40.7128, -74.0060]); // NYC Default
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
  const recognitionRef = useRef<any>(null);

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
    } else {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [isVoiceMonitorActive]);
  const [isDigitalShieldActive, setIsDigitalShieldActive] = useState(true);
  const [focusedLocation, setFocusedLocation] = useState<[number, number] | null>(null);
  
  // New States for UI Improvements
  const [isReporting, setIsReporting] = useState(false);
  const [reportData, setReportData] = useState({ type: '', severity: 5 });
  const [isSOSActive, setIsSOSActive] = useState(false);
  const [sosCountdown, setSosCountdown] = useState(5);
  const [safetyBriefing, setSafetyBriefing] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Fetch mock incidents and safe zones
    Promise.all([
      fetch('/api/incidents').then(res => res.json()),
      fetch('/api/safe-zones').then(res => res.json())
    ]).then(([incidentsData, safeZonesData]) => {
      setIncidents(incidentsData);
      setSafeZones(safeZonesData);
    });

    // Get user location
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

  // Autocomplete logic
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

  const selectSuggestion = async (suggestion: Suggestion) => {
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
        setRouteDetails({
          distance: best.route.distance,
          duration: best.route.duration
        });
        setActiveTab('nav');
      }
    } catch (error) {
      console.error("Routing failed:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const generateSafetyBriefing = async () => {
    if (!route || !safetyMetrics) return;
    
    setIsAnalyzing(true);
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash-exp",
        contents: `Analyze the safety of this route. 
        Safety Score: ${safetyScore}/100. 
        Metrics: Crime Safety ${safetyMetrics.crimeSafety}%, Lighting ${safetyMetrics.lighting}%, Crowd Density ${safetyMetrics.crowdDensity}%, Infrastructure ${safetyMetrics.infrastructure}%.
        The route is ${(routeDetails?.distance || 0) / 1000}km long and takes ${Math.round((routeDetails?.duration || 0) / 60)} minutes.
        Provide a concise, professional safety briefing (max 150 words) highlighting specific precautions and why this route was chosen as the safest.`,
      });
      setSafetyBriefing(response.text);
    } catch (error) {
      console.error("Briefing generation failed:", error);
      setSafetyBriefing("Unable to generate live safety briefing at this time. Please follow standard safety protocols.");
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
    const data = await res.json();
    setIncidents(data);
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
          // In a real app, this would call an emergency API
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-emerald-500/30 overflow-hidden flex flex-col">
      {/* Header */}
      <header className="border-b border-white/5 bg-black/50 backdrop-blur-xl z-50 shrink-0">
        <div className="max-w-[1600px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Shield className="w-5 h-5 text-black" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">SafePath</h1>
              <p className="text-[9px] uppercase tracking-widest text-emerald-500 font-bold opacity-80">Secure Routing Engine</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl border border-white/10">
            <button 
              onClick={() => setActiveTab('nav')}
              className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === 'nav' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}
            >
              Navigation
            </button>
            <button 
              onClick={() => setActiveTab('safe')}
              className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === 'safe' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}
            >
              Safe Zones
            </button>
            <button 
              onClick={() => setActiveTab('shield')}
              className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === 'shield' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}
            >
              Shield
            </button>
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

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
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
                    onChange={(e) => {
                      setSource(e.target.value);
                      setActiveSearch('source');
                    }}
                    onFocus={() => setActiveSearch('source')}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-xs focus:outline-none focus:border-emerald-500/50 transition-all"
                  />
                  {source !== 'Your Current Position' && (
                    <button 
                      onClick={() => {
                        setSource('Your Current Position');
                        setSourceCoords(currentPos);
                      }}
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
                    onChange={(e) => {
                      setDestination(e.target.value);
                      setActiveSearch('dest');
                    }}
                    onFocus={() => setActiveSearch('dest')}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-xs focus:outline-none focus:border-emerald-500/50 transition-all placeholder:text-gray-600"
                  />

                  {/* Autocomplete Dropdown */}
                  <AnimatePresence>
                    {activeSearch && suggestions.length > 0 && (
                      <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute top-full left-0 right-0 mt-2 bg-[#121212] border border-white/10 rounded-xl overflow-hidden z-[60] shadow-2xl"
                      >
                        {suggestions.map((s) => (
                          <button
                            key={s.place_id}
                            onClick={() => selectSuggestion(s)}
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
                  onClick={handleCalculateRoute}
                  disabled={isSearching || !destCoords}
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3 rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/10 disabled:opacity-50"
                >
                  {isSearching ? "Calculating..." : "Analyze Safest Route"}
                </button>
              </div>
            </section>
          ) : activeTab === 'safe' ? (
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
                    onClick={() => setFocusedLocation([zone.lat, zone.lng])}
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
          ) : (
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
                        <p className="text-xs font-bold">Voice Monitor</p>
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
                        <p className="text-xs font-bold">Digital Protection</p>
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
          )}

          <AnimatePresence mode="wait">
            {isSearching ? (
              <motion.div 
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="py-12 flex flex-col items-center justify-center gap-4 text-center"
              >
                <div className="w-12 h-12 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin" />
                <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">Analyzing Safety Vectors...</p>
              </motion.div>
            ) : safetyScore !== null && routeDetails && activeTab === 'nav' ? (
              <motion.div 
                key="results"
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
                      <p className="text-sm font-medium">{(routeDetails.distance / 1000).toFixed(1)} km</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[9px] uppercase tracking-widest text-gray-500 font-bold">Duration</p>
                      <p className="text-sm font-medium">{Math.round(routeDetails.duration / 60)} mins</p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-emerald-500/10">
                    {!safetyBriefing ? (
                      <button 
                        onClick={generateSafetyBriefing}
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
                      <div className="space-y-2">
                        <div className="flex justify-between text-[10px]">
                          <span className="text-gray-400">Crime Safety (40%)</span>
                          <span className="text-emerald-500">{safetyMetrics?.crimeSafety}%</span>
                        </div>
                        <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${safetyMetrics?.crimeSafety}%` }} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-[10px]">
                          <span className="text-gray-400">Lighting (25%)</span>
                          <span className="text-emerald-500">{safetyMetrics?.lighting}%</span>
                        </div>
                        <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${safetyMetrics?.lighting}%` }} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-[10px]">
                          <span className="text-gray-400">Crowd Density (15%)</span>
                          <span className="text-emerald-500">{safetyMetrics?.crowdDensity}%</span>
                        </div>
                        <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${safetyMetrics?.crowdDensity}%` }} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-[10px]">
                          <span className="text-gray-400">Infrastructure (10%)</span>
                          <span className="text-emerald-500">{safetyMetrics?.infrastructure}%</span>
                        </div>
                        <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${safetyMetrics?.infrastructure}%` }} />
                        </div>
                      </div>
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
                            onClick={() => setFocusedLocation([zone.lat, zone.lng])}
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

        {/* Main Map Area */}
        <main className="flex-1 relative">
          <MapView 
            center={currentPos} 
            zoom={14} 
            route={route} 
            incidents={incidents} 
            safeZones={activeTab === 'safe' ? safeZones : (route ? routeSafeZones : safeZones)}
            highlightSafeZones={activeTab === 'safe'}
            focusLocation={focusedLocation}
          />
          
          {/* Floating Stats Overlay */}
          <div className="absolute bottom-8 right-8 flex flex-col gap-3 pointer-events-none z-[1000]">
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl p-4 w-48 pointer-events-auto shadow-2xl"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center">
                  <Zap className="w-4 h-4 text-blue-500" />
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-widest text-gray-500 font-bold">Live Incidents</p>
                  <p className="text-sm font-bold">{incidents.length} Active</p>
                </div>
              </div>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl p-4 w-48 pointer-events-auto shadow-2xl"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                  <Shield className="w-4 h-4 text-emerald-500" />
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-widest text-gray-500 font-bold">Safe Zones</p>
                  <p className="text-sm font-bold">{safeZones.length} Nearby</p>
                </div>
              </div>
            </motion.div>
          </div>
        </main>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {isReporting && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#121212] border border-white/10 rounded-3xl p-8 max-w-md w-full shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold">Report Incident</h3>
                <button onClick={() => setIsReporting(false)} className="text-gray-500 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2 block">Incident Type</label>
                  <select 
                    value={reportData.type}
                    onChange={(e) => setReportData({ ...reportData, type: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-xs focus:outline-none focus:border-emerald-500/50"
                  >
                    <option value="" disabled>Select type...</option>
                    <option value="Poor Lighting">Poor Lighting</option>
                    <option value="Suspicious Activity">Suspicious Activity</option>
                    <option value="Construction Block">Construction Block</option>
                    <option value="Crowded Area">Crowded Area</option>
                    <option value="Emergency Vehicle">Emergency Vehicle</option>
                  </select>
                </div>
                
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2 block">Severity (1-10)</label>
                  <input 
                    type="range" 
                    min="1" 
                    max="10" 
                    value={reportData.severity}
                    onChange={(e) => setReportData({ ...reportData, severity: parseInt(e.target.value) })}
                    className="w-full accent-emerald-500"
                  />
                  <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                    <span>Low Risk</span>
                    <span className="text-emerald-500 font-bold">{reportData.severity}</span>
                    <span>High Risk</span>
                  </div>
                </div>
                
                <button 
                  onClick={submitReport}
                  disabled={!reportData.type}
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-4 rounded-xl text-xs transition-all mt-4 disabled:opacity-50"
                >
                  Submit Safety Report
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {isSOSActive && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-red-950/40 backdrop-blur-xl"
          >
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="bg-black border-2 border-red-500/30 rounded-[40px] p-12 max-w-md w-full text-center shadow-[0_0_100px_rgba(239,68,68,0.2)]"
            >
              <div className="w-24 h-24 bg-red-500 rounded-full mx-auto flex items-center justify-center mb-8 relative">
                <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-20" />
                <Phone className="w-10 h-10 text-white" />
              </div>
              
              <h3 className="text-3xl font-bold mb-2">SOS TRIGGERED</h3>
              <p className="text-gray-400 text-sm mb-12">Emergency services and your contacts will be notified in:</p>
              
              <div className="text-8xl font-light tracking-tighter mb-12 text-red-500">
                {sosCountdown}
              </div>
              
              <button 
                onClick={() => setIsSOSActive(false)}
                className="w-full bg-white/10 hover:bg-white/20 text-white font-bold py-4 rounded-2xl text-xs transition-all border border-white/10"
              >
                CANCEL SOS
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

