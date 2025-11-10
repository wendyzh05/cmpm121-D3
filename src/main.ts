// @deno-types="npm:@types/leaflet"
import leaflet from "leaflet";

import "leaflet/dist/leaflet.css";
import "./style.css";
import "./_leafletWorkaround.ts";
import luck from "./_luck.ts";

// Game constants
const CLASSROOM_LATLNG = leaflet.latLng(
  36.997936938057016,
  -122.05703507501151,
);

const ZOOM = 19;
const SPAWN_RADIUS = 0.002;
const TOKEN_COUNT = 80;
const INTERACT_DISTANCE = 30;

// UI elements
function createDiv(id: string): HTMLDivElement {
  const div = document.createElement("div");
  div.id = id;
  document.body.append(div);
  return div;
}

const mapDiv = createDiv("map");
const statusPanelDiv = createDiv("statusPanel");

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

// Game State
let heldValue: number | null = null;

type PlantToken = {
  lat: number;
  lng: number;
  value: number;
  marker: leaflet.Marker;
};

const tokens: PlantToken[] = [];

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

function meters(a: leaflet.LatLng, b: leaflet.LatLng) {
  return a.distanceTo(b);
}

function randomLatLng(
  center: leaflet.LatLng,
  radius: number,
  seed1: number,
  seed2: number,
) {
  const angle = seed1 * 2 * Math.PI;
  const dist = seed2 * radius;
  return leaflet.latLng(
    center.lat + Math.cos(angle) * dist,
    center.lng + Math.sin(angle) * dist,
  );
}

function bindTokenPopup(token: PlantToken) {
  token.marker.on("mouseover", () => {
    token.marker.bindPopup(`
      <div style="font-size:16px;">
        ${emojiFor(token.value)} Value ${token.value}
        <br><small>Move within ${INTERACT_DISTANCE}m to interact</small>
      </div>
    `).openPopup();
  });
  token.marker.on("mouseout", () => token.marker.closePopup());
  token.marker.on("click", () => onTokenClick(token));
}

// Random plant token spawning (deterministic)

function spawnTokens() {
  for (let n = 0; n < TOKEN_COUNT; n++) {
    const latLng = randomLatLng(
      CLASSROOM_LATLNG,
      SPAWN_RADIUS,
      luck("token-" + n),
      luck("token-pos-" + n),
    );

    const value = 1; // initial token value

    const marker = leaflet.marker([latLng.lat, latLng.lng], {
      icon: leaflet.divIcon({
        className: "token-label",
        html: emojiFor(value),
      }),
    }).addTo(map);

    const token: PlantToken = {
      lat: latLng.lat,
      lng: latLng.lng,
      value,
      marker,
    };
    tokens.push(token);

    bindTokenPopup(token);
  }
}

function pickUpToken(token: PlantToken) {
  heldValue = token.value;
  token.marker.remove();
  token.value = 0;
  updateStatus();
  checkWin();
}

function mergeToken(token: PlantToken): boolean {
  if (heldValue === null || heldValue !== token.value) return false;

  const newVal = heldValue * 2;
  heldValue = null;

  token.marker.remove();
  token.value = newVal;
  token.marker = leaflet.marker([token.lat, token.lng], {
    icon: leaflet.divIcon({ className: "token-label", html: emojiFor(newVal) }),
  }).addTo(map);

  bindTokenPopup(token);
  updateStatus();
  checkWin();
  return true;
}

function onTokenClick(token: PlantToken) {
  const playerPos = playerMarker.getLatLng();
  const tokenPos = leaflet.latLng(token.lat, token.lng);
  const dist = meters(playerPos, tokenPos);

  if (dist > INTERACT_DISTANCE) {
    statusPanelDiv.textContent = `Too far! Move closer. Distance: ${
      dist.toFixed(0)
    }m`;
    return;
  }

  if (mergeToken(token)) return;

  pickUpToken(token);
}

function checkWin() {
  if (heldValue !== null && heldValue >= 256) {
    alert("You grew a 🌳 TREE! You win!");
  }
}

updateStatus();
spawnTokens();
