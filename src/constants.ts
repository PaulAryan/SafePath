export const SAFETY_VECTORS = [
  { id: 'crime', label: 'Crime Safety', weight: 0.40, color: 'emerald' },
  { id: 'lighting', label: 'Lighting', weight: 0.25, color: 'emerald' },
  { id: 'crowd', label: 'Crowd Density', weight: 0.15, color: 'emerald' },
  { id: 'infrastructure', label: 'Infrastructure', weight: 0.10, color: 'emerald' },
];

export const INCIDENT_TYPES = [
  "Poor Lighting",
  "Suspicious Activity",
  "Construction Block",
  "Crowded Area",
  "Emergency Vehicle"
];

export const DEFAULT_CENTER: [number, number] = [40.7128, -74.0060]; // NYC
