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

function createDiv(id: string): HTMLDivElement {
  const div = document.createElement("div");
  div.id = id;
  document.body.append(div);
  return div;
}

const controlPanelDiv = createDiv("controls");

const ZOOM = 19;
const SPAWN_RADIUS = 0.002;
const TOKEN_COUNT = 80;
const INTERACT_DISTANCE = 30;
const STEP_SIZE = 0.001;
const CELL_SIZE = 0.001;

//Cell helpers

function getCell(lat: number, lng: number) {
  const row = Math.floor(lat / CELL_SIZE);
  const col = Math.floor(lng / CELL_SIZE);
  return { row, col };
}

//Per-token persistence map
const savedTokens: Record<string, number> = {};

function saveToken(seedKey: string, value: number) {
  savedTokens[seedKey] = value;
}

function loadToken(seedKey: string): number | undefined {
  return savedTokens[seedKey];
}

const mapDiv = createDiv("map");
const statusPanelDiv = createDiv("statusPanel");

function loadGameState() {
  const tok = localStorage.getItem("savedTokens");
  if (tok) Object.assign(savedTokens, JSON.parse(tok));

  const lat = localStorage.getItem("playerLat");
  const lng = localStorage.getItem("playerLng");
  if (lat && lng) playerLatLng = leaflet.latLng(Number(lat), Number(lng));

  const hv = localStorage.getItem("heldValue");
  heldValue = hv === "null" ? null : hv ? Number(hv) : null;
}

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
  .tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors',
    subdomains: ["a", "b", "c"],
  })
  .addTo(map);

// Player state
let playerLatLng = CLASSROOM_LATLNG;
const playerMarker = leaflet.marker(playerLatLng).addTo(map).bindTooltip(
  "You 🌸",
);

// Game State
let heldValue: number | null = null;

type PlantToken = {
  lat: number;
  lng: number;
  value: number;
  marker: leaflet.Marker;
  seedKey: string; // UNIQUE ID
};

let tokens: PlantToken[] = [];

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

// Deterministic random
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

//Random plant token spawning (deterministic)
function spawnTokens(center: leaflet.LatLng) {
  tokens.forEach((t) => t.marker.remove());
  tokens = [];

  const { row, col } = getCell(center.lat, center.lng);

  for (let n = 0; n < TOKEN_COUNT; n++) {
    const seedKey = `cell:${row},${col}-token:${n}`;
    const latLng = randomLatLng(
      center,
      SPAWN_RADIUS,
      luck(seedKey + "-1"),
      luck(seedKey + "-2"),
    );
    const saved = loadToken(seedKey);
    const value = saved !== undefined ? saved : 1;

    if (value === 0) continue;

    const marker = leaflet.marker([latLng.lat, latLng.lng], {
      icon: leaflet.divIcon({
        className: "token-label",
        html: `<div style="font-size:26px">${emojiFor(value)}</div>`,
      }),
    }).addTo(map);

    const token: PlantToken = {
      lat: latLng.lat,
      lng: latLng.lng,
      value,
      marker,
      seedKey,
    };

    tokens.push(token);
    bindTokenPopup(token);
  }
}

function pickUpToken(token: PlantToken) {
  heldValue = token.value;
  saveToken(token.seedKey, 0);
  token.marker.remove();
  token.value = 0;
  updateStatus();
  checkWin();
}

function mergeToken(token: PlantToken): boolean {
  if (heldValue === null || heldValue !== token.value) return false;

  const newVal = heldValue * 2;
  heldValue = null;

  saveToken(token.seedKey, newVal);

  token.marker.remove();
  token.value = newVal;

  token.marker = leaflet.marker([token.lat, token.lng], {
    icon: leaflet.divIcon({
      className: "token-label",
      html: `<div style="font-size:26px">${emojiFor(newVal)}</div>`,
    }),
  }).addTo(map);

  bindTokenPopup(token);
  updateStatus();
  checkWin();
  return true;
}

//Interaction
function onTokenClick(token: PlantToken) {
  const dist = meters(playerLatLng, leaflet.latLng(token.lat, token.lng));

  if (dist > INTERACT_DISTANCE) {
    statusPanelDiv.textContent = `Too far! (${dist.toFixed(0)}m)`;
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

//Movement
const moveDiv = document.createElement("div");
moveDiv.id = "movePanel";
moveDiv.innerHTML = `
  <h3>Move</h3>
  <button id="moveN">UP⬆️</button>
  <button id="moveS">DOWN⬇️</button>
  <button id="moveW">LEFT⬅️</button>
  <button id="moveE">RIGHT➡️</button>
`;
controlPanelDiv.append(moveDiv);

interface MovementController {
  start(): void;
  stop(): void;
}

class ButtonMovement implements MovementController {
  constructor(private callback: (lat: number, lng: number) => void) {}

  start() {}
  stop() {}

  move(dLat: number, dLng: number) {
    this.callback(dLat, dLng);
  }
}

class GeoMovement implements MovementController {
  watchId: number | null = null;

  constructor(private callback: (lat: number, lng: number) => void) {}

  start() {
    if (!navigator.geolocation) {
      alert("Geolocation not supported!");
      return;
    }

    this.watchId = navigator.geolocation.watchPosition((pos) => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      this.callback(lat - playerLatLng.lat, lng - playerLatLng.lng);
    });
  }

  stop() {
    if (this.watchId !== null) navigator.geolocation.clearWatch(this.watchId);
  }
}

function movePlayer(dLat: number, dLng: number) {
  playerLatLng = leaflet.latLng(
    playerLatLng.lat + dLat,
    playerLatLng.lng + dLng,
  );
  playerMarker.setLatLng(playerLatLng);
  map.setView(playerLatLng);
  spawnTokens(playerLatLng);
}

const buttonMovement = new ButtonMovement(movePlayer);

document.getElementById("moveN")!.addEventListener(
  "click",
  () => buttonMovement.move(STEP_SIZE, 0),
);
document.getElementById("moveS")!.addEventListener(
  "click",
  () => buttonMovement.move(-STEP_SIZE, 0),
);
document.getElementById("moveE")!.addEventListener(
  "click",
  () => buttonMovement.move(0, STEP_SIZE),
);
document.getElementById("moveW")!.addEventListener(
  "click",
  () => buttonMovement.move(0, -STEP_SIZE),
);

let movementMode: MovementController = buttonMovement;

const movementSwitch = document.createElement("button");
movementSwitch.textContent = "Use Geolocation 🌍";
movementSwitch.onclick = () => {
  movementMode.stop();

  if (movementMode instanceof ButtonMovement) {
    movementMode = new GeoMovement(movePlayer);
    movementSwitch.textContent = "Use Buttons 🎮";
    movementMode.start();
  } else {
    movementMode = buttonMovement;
    movementSwitch.textContent = "Use Geolocation 🌍";
  }
};

controlPanelDiv.append(movementSwitch);

loadGameState();
updateStatus();
spawnTokens(playerLatLng);
map.setView(playerLatLng);
playerMarker.setLatLng(playerLatLng);
