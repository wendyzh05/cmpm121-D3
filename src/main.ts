// @deno-types="npm:@types/leaflet"
import leaflet from "leaflet";

import "leaflet/dist/leaflet.css";
import "./style.css";
import "./_leafletWorkaround.ts";
import luck from "./_luck.ts";

// UI elements
const controlPanelDiv = document.createElement("div");
controlPanelDiv.id = "controlPanel";
document.body.append(controlPanelDiv);

const mapDiv = document.createElement("div");
mapDiv.id = "map";
document.body.append(mapDiv);

const statusPanelDiv = document.createElement("div");
statusPanelDiv.id = "statusPanel";
document.body.append(statusPanelDiv);

// Game constants
const CLASSROOM_LATLNG = leaflet.latLng(
  36.997936938057016,
  -122.05703507501151,
);

const ZOOM = 19;
const SPAWN_RADIUS = 0.002;
const TOKEN_COUNT = 80;
const INTERACT_DISTANCE = 30;

// Map setup
const map = leaflet.map(mapDiv, {
  center: CLASSROOM_LATLNG,
  zoom: ZOOM,
  minZoom: ZOOM,
  maxZoom: ZOOM,
  zoomControl: false,
  scrollWheelZoom: false,
});

leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 })
  .addTo(map);

const playerMarker = leaflet.marker(CLASSROOM_LATLNG).addTo(map);

// Inventory
let heldValue: number | null = null;

function emojiFor(v: number): string {
  const m: Record<number, string> = {
    1: "🌱",
    2: "🌿",
    4: "🌸",
    8: "🌻",
    16: "🌷",
    32: "🌺",
    64: "🌴",
    128: "🌾",
    256: "🌳",
  };
  return m[v] ?? "";
}

function updateStatus() {
  statusPanelDiv.textContent = heldValue === null
    ? "In hand: empty"
    : `In hand: ${emojiFor(heldValue)} (${heldValue})`;
}

updateStatus();

// Random plant token spawning (deterministic)
type PlantToken = {
  lat: number;
  lng: number;
  value: number;
  marker: leaflet.Marker;
};

const tokens: PlantToken[] = [];

function spawnTokens() {
  for (let n = 0; n < TOKEN_COUNT; n++) {
    const r = luck("token-" + n);
    const r2 = luck("token-pos-" + n);

    // random angle + radius around player
    const angle = r * 2 * Math.PI;
    const dist = r2 * SPAWN_RADIUS;

    const lat = CLASSROOM_LATLNG.lat + Math.cos(angle) * dist;
    const lng = CLASSROOM_LATLNG.lng + Math.sin(angle) * dist;

    // random value: 1 always (matching D3.a initial seeds)
    const value = 1;

    const marker = leaflet.marker([lat, lng], {
      icon: leaflet.divIcon({
        className: "token-label",
        html: `<div style="font-size:22px;">${emojiFor(value)}</div>`,
      }),
    }).addTo(map);

    const token: PlantToken = { lat, lng, value, marker };
    tokens.push(token);

    marker.on("mouseover", () => {
      marker.bindPopup(`
        <div style="font-size:18px;">
          ${emojiFor(token.value)} Value ${token.value}
        </div>
        <div style="margin-top:6px;font-size:12px;">
          <b>Hover:</b> View plant info<br>
          <b>Click:</b> Pick up or merge<br>
          <small>Stay within ${INTERACT_DISTANCE}m</small>
        </div>
      `).openPopup();
    });

    marker.on("mouseout", () => {
      marker.closePopup();
    });
    marker.on("click", () => onTokenClick(token));
  }
}

// Distance helper
function meters(a: leaflet.LatLng, b: leaflet.LatLng) {
  return a.distanceTo(b);
}

// Token interaction
function onTokenClick(token: PlantToken) {
  const playerPos = playerMarker.getLatLng();
  const tokenPos = leaflet.latLng(token.lat, token.lng);
  const dist = meters(playerPos, tokenPos);

  // Too far
  if (dist > INTERACT_DISTANCE) {
    statusPanelDiv.textContent = `Too far! Move closer. Distance: ${
      dist.toFixed(0)
    }m / Allowed: ${INTERACT_DISTANCE}m`;
    alert(`You are too far away (${dist.toFixed(0)}m). Move closer!`);
    return;
  }

  // MERGE (same value)
  if (heldValue !== null && token.value === heldValue) {
    const newVal = heldValue * 2;

    // Update token
    heldValue = null;
    token.value = newVal;

    token.marker.remove();
    token.marker = leaflet.marker([token.lat, token.lng], {
      icon: leaflet.divIcon({
        className: "token-label",
        html: `<div style="font-size:22px;">${emojiFor(newVal)}</div>`,
      }),
    }).addTo(map);

    // hover popup for merged token
    token.marker.on("mouseover", () => {
      token.marker.bindPopup(`
        <div style="font-size:16px;">
          ${emojiFor(newVal)} Value ${newVal}
          <br><small>Move within ${INTERACT_DISTANCE}m to interact</small>
        </div>
      `).openPopup();
    });

    token.marker.on("mouseout", () => token.marker.closePopup());

    token.marker.on("click", () => onTokenClick(token));

    updateStatus();
    checkWin();
    return;
  }

  // PICK UP (always allowed when not merging)
  heldValue = token.value;

  token.marker.remove();
  token.value = 0;

  updateStatus();
  checkWin();
}

// Win condition
function checkWin() {
  if (heldValue !== null && heldValue >= 256) {
    alert("You grew a 🌳 TREE! You win!");
  }
}

// Start
spawnTokens();
