export interface Incident {
  id: number;
  lat: number;
  lng: number;
  type: string;
  severity: number;
  timestamp: string;
}

export interface SafeZone {
  id: number;
  lat: number;
  lng: number;
  name: string;
  type: string;
}

export interface RouteData {
  coordinates: [number, number][];
  distance: number;
  duration: number;
  safetyScore?: number;
}
