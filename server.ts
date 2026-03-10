import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import Database from "better-sqlite3";

const db = new Database("safety.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS incidents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lat REAL,
    lng REAL,
    type TEXT,
    severity INTEGER,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE TABLE IF NOT EXISTS safe_zones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lat REAL,
    lng REAL,
    name TEXT,
    type TEXT -- 'police', 'hospital', '24h_store'
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    emergency_contact TEXT
  );
`);

// Populate mock safe zones if empty
const safeZonesCount = db.prepare("SELECT COUNT(*) as count FROM safe_zones").get() as { count: number };
if (safeZonesCount.count === 0) {
  const insert = db.prepare("INSERT INTO safe_zones (lat, lng, name, type) VALUES (?, ?, ?, ?)");
  // Mock data around NYC
  insert.run(40.7128, -74.0060, "Central Police Precinct", "police");
  insert.run(40.7200, -74.0100, "City General Hospital", "hospital");
  insert.run(40.7050, -73.9950, "24/7 Safe Haven Mart", "24h_store");
  insert.run(40.7300, -73.9900, "Metro Health Center", "hospital");
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/incidents", (req, res) => {
    const incidents = db.prepare("SELECT * FROM incidents").all();
    res.json(incidents);
  });

  app.get("/api/safe-zones", (req, res) => {
    const zones = db.prepare("SELECT * FROM safe_zones").all();
    res.json(zones);
  });

  app.post("/api/incidents", (req, res) => {
    const { lat, lng, type, severity } = req.body;
    const info = db.prepare("INSERT INTO incidents (lat, lng, type, severity) VALUES (?, ?, ?, ?)").run(lat, lng, type, severity);
    res.json({ id: info.lastInsertRowid });
  });

  // Mock Safety Scoring Endpoint
  app.post("/api/score-route", (req, res) => {
    const { coordinates } = req.body; // Array of [lat, lng]
    
    // Genuine Safety Scoring Logic:
    // 1. Base risk (no route is 100% safe, especially in urban areas)
    // 2. Proximity to incidents (negative)
    // 3. Proximity to safe zones (positive)
    // 4. Route length (longer routes have more exposure)
    
    // User Provided Formula:
    // FINAL SAFETY SCORE = 
    // (0.40 × CRIME_SAFETY) +      # 40% weight - Most important
    // (0.25 × LIGHTING_SCORE) +     # 25% weight - Critical at night
    // (0.15 × CROWD_DENSITY) +      # 15% weight - Safety in numbers
    // (0.10 × INFRASTRUCTURE) +      # 10% weight - Police, hospitals nearby
    // (0.10 × TIME_ADJUSTMENT)       # 10% weight - Day vs night

    const incidents = db.prepare("SELECT * FROM incidents").all();
    const safeZones = db.prepare("SELECT * FROM safe_zones").all();
    
    // Calculate sub-scores based on route coordinates
    let crimeRisk = 0;
    let infrastructureBonus = 0;
    const nearbySafeZoneIds = new Set<number>();
    
    coordinates.forEach((coord: [number, number]) => {
      // Crime Safety (Inverse of incident proximity)
      incidents.forEach((incident: any) => {
        const dist = Math.sqrt(Math.pow(coord[0] - incident.lat, 2) + Math.pow(coord[1] - incident.lng, 2));
        if (dist < 0.005) { // 500m
          crimeRisk += (incident.severity * 5) * (1 - dist / 0.005);
        }
      });

      // Infrastructure (Police, hospitals nearby)
      safeZones.forEach((zone: any) => {
        const dist = Math.sqrt(Math.pow(coord[0] - zone.lat, 2) + Math.pow(coord[1] - zone.lng, 2));
        if (dist < 0.003) { // 300m
          infrastructureBonus += 10 * (1 - dist / 0.003);
          nearbySafeZoneIds.add(zone.id);
        }
      });
    });

    const nearbySafeZones = safeZones.filter((z: any) => nearbySafeZoneIds.has(z.id));

    // Normalize sub-scores to 0-100
    const crimeSafety = Math.max(0, 100 - (crimeRisk / Math.sqrt(coordinates.length)));
    const infrastructure = Math.min(100, (infrastructureBonus / Math.sqrt(coordinates.length)) * 5);
    
    // Mocked scores for lighting and crowd (would ideally come from OSM/real-time data)
    const lightingScore = 70 + Math.random() * 30;
    const crowdDensity = 60 + Math.random() * 40;
    
    // Time Adjustment (Day vs Night)
    const hour = new Date().getHours();
    const isNight = hour < 6 || hour > 19;
    const timeAdjustment = isNight ? 60 : 100;

    const finalScore = (
      (0.40 * crimeSafety) +
      (0.25 * lightingScore) +
      (0.15 * crowdDensity) +
      (0.10 * infrastructure) +
      (0.10 * timeAdjustment)
    );
    
    res.json({ 
      safetyScore: Math.round(finalScore),
      nearbySafeZones,
      metrics: {
        lighting: Math.round(lightingScore),
        crowdDensity: Math.round(crowdDensity),
        infrastructure: Math.round(infrastructure),
        crimeSafety: Math.round(crimeSafety),
        timeAdjustment: Math.round(timeAdjustment)
      }
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
