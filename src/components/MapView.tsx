import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import { useEffect } from 'react';

// Fix for default marker icons in Leaflet with React
// @ts-ignore
import markerIcon from 'leaflet/dist/images/marker-icon.png';
// @ts-ignore
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface MapViewProps {
  center: [number, number];
  zoom: number;
  route?: [number, number][];
  incidents?: any[];
  safeZones?: any[];
  highlightSafeZones?: boolean;
  focusLocation?: [number, number] | null;
}

function MapController({ center, zoom, route, focusLocation }: { center: [number, number], zoom: number, route?: [number, number][], focusLocation?: [number, number] | null }) {
  const map = useMap();
  
  useEffect(() => {
    if (focusLocation) {
      map.flyTo(focusLocation, 16, { duration: 1.5 });
    } else if (route && route.length > 0) {
      const bounds = L.latLngBounds(route.map(c => L.latLng(c[0], c[1])));
      map.fitBounds(bounds, { padding: [50, 50] });
    } else {
      map.setView(center, zoom);
    }
  }, [center, zoom, route, map, focusLocation]);

  return null;
}

export default function MapView({ center, zoom, route, incidents, safeZones, highlightSafeZones, focusLocation }: MapViewProps) {
  return (
    <MapContainer 
      center={center} 
      zoom={zoom} 
      zoomControl={false}
      style={{ height: '100%', width: '100%' }}
      className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapController center={center} zoom={zoom} route={route} focusLocation={focusLocation} />
      <ZoomControl position="bottomright" />
      
      {route && route.length > 0 && (
        <>
          <Polyline 
            positions={route} 
            color="#10b981" 
            weight={8} 
            opacity={0.3} 
          />
          <Polyline 
            positions={route} 
            color="#10b981" 
            weight={4} 
            opacity={0.8} 
          />
          
          {/* Start and End Markers */}
          <Marker position={route[0]}>
            <Popup>Start Location</Popup>
          </Marker>
          <Marker position={route[route.length - 1]}>
            <Popup>Destination</Popup>
          </Marker>
        </>
      )}

      {incidents?.map((incident) => (
        <Marker key={`incident-${incident.id}`} position={[incident.lat, incident.lng]}>
          <Popup>
            <div className="p-2 min-w-[150px]">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <h3 className="font-bold text-red-500 text-xs uppercase tracking-wider">{incident.type}</h3>
              </div>
              <p className="text-[10px] text-gray-400 mb-2 leading-relaxed">Safety risk detected in this sector. Exercise caution.</p>
              <div className="flex justify-between items-center text-[9px] font-bold text-gray-500 border-t border-white/5 pt-2">
                <span>SEVERITY: {incident.severity}/10</span>
                <span>{new Date(incident.timestamp).toLocaleTimeString()}</span>
              </div>
            </div>
          </Popup>
        </Marker>
      ))}

      {safeZones?.map((zone) => (
        <Marker 
          key={`safezone-${zone.id}`} 
          position={[zone.lat, zone.lng]}
          icon={L.divIcon({
            className: 'custom-div-icon',
            html: `
              <div class="relative">
                ${highlightSafeZones ? `
                  <div class="absolute -inset-6 bg-emerald-500/30 rounded-full animate-ping"></div>
                  <div class="absolute -inset-4 bg-emerald-500/20 rounded-full animate-pulse"></div>
                ` : ''}
                <div class="w-8 h-8 bg-emerald-500 rounded-full border-2 border-white flex items-center justify-center shadow-lg relative z-10 transition-all duration-500 ${highlightSafeZones ? 'scale-125 shadow-emerald-500/50' : 'scale-100'}">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="text-white"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                </div>
              </div>
            `,
            iconSize: [32, 32],
            iconAnchor: [16, 16]
          })}
        >
          <Popup>
            <div className="p-2 min-w-[150px]">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <h3 className="font-bold text-emerald-500 text-xs uppercase tracking-wider">Safe Zone</h3>
              </div>
              <p className="text-[11px] font-bold text-white mb-1">{zone.name}</p>
              <p className="text-[10px] text-gray-400 leading-relaxed capitalize">{zone.type.replace('_', ' ')}</p>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}

