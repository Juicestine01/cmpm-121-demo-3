// Imports
import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";
import "./leafletWorkaround.ts";
import { Board } from "./board.ts";

// DOM and gameplay setup
const app = document.querySelector<HTMLDivElement>("#app")!;
const button = document.createElement("button");
button.innerHTML = "click me!";
button.addEventListener("click", () => alert("You clicked the button!"));
app.append(button);

export class Player {
  location: leaflet.LatLng;

  constructor(initialLocation: leaflet.LatLng) {
    this.location = initialLocation;
  }

  move(direction: "north" | "south" | "west" | "east") {
    const delta = 1e-4; // TILE_DEGREES
    switch (direction) {
      case "north":
        this.location = leaflet.latLng(
          this.location.lat + delta,
          this.location.lng,
        );
        break;
      case "south":
        this.location = leaflet.latLng(
          this.location.lat - delta,
          this.location.lng,
        );
        break;
      case "west":
        this.location = leaflet.latLng(
          this.location.lat,
          this.location.lng - delta,
        );
        break;
      case "east":
        this.location = leaflet.latLng(
          this.location.lat,
          this.location.lng + delta,
        );
        break;
    }
  }
}

const player = new Player(
  leaflet.latLng(36.98949379578401, -122.06277128548504),
);
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const NEIGHBORHOOD_SIZE = 8;
const CACHE_SPAWN_PROBABILITY = 0.1;

const map = leaflet.map(document.getElementById("map")!, {
  center: player.location,
  zoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: false,
  scrollWheelZoom: false,
});

leaflet.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution:
    '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);

const playerMarker = leaflet.marker(player.location).addTo(map);

// Bind the initial popup content
playerMarker.bindPopup(() => {
  const popupDiv1 = document.createElement("div");

  // Convert the player's location to (i, j) coordinates
  const playerCoordinates = board.getCellForPoint(player.location);

  // Display the coordinates in the popup
  popupDiv1.innerHTML =
    `Player Location: (${playerCoordinates.i}, ${playerCoordinates.j})`;

  return popupDiv1;
});

let watchId: number | null = null; // Track the watch ID for geolocation
let isSensorActive = false; // Track if the sensor is currently active

export interface Coins {
  serial: number; // Unique identifier for each coin
  identity: string; // Unique identity based on cache
  cell: { i: number; j: number }; // Coordinates of the cache where the coin originated
}

interface Inventory {
  coins: Coins[];
  collect(coin: Coins): void;
  deposit(coin: Coins): void;
}

export const playerInventory: Inventory = {
  coins: [],
  collect(coin: Coins) {
    this.coins.push(coin);
  },
  deposit(coin: Coins) {
    const index = this.coins.findIndex((c) =>
      c.serial === coin.serial &&
      c.cell.i === coin.cell.i &&
      c.cell.j === coin.cell.j
    );
    if (index !== -1) {
      this.coins.splice(index, 1);
    }
  },
};

const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
statusPanel.innerHTML = "Num Coins: 0";

// Instantiate the board with gameplay parameters
const board = new Board(
  TILE_DEGREES,
  NEIGHBORHOOD_SIZE,
  CACHE_SPAWN_PROBABILITY,
);

function spawnCache() {
  const visibleCaches = board.getCellsNearPoint(player.location);

  // Remove existing cache layers (rectangles) from the map
  map.eachLayer((layer: leaflet.Layer) => {
    if (layer instanceof leaflet.Rectangle) {
      map.removeLayer(layer);
    }
  });

  visibleCaches.forEach((cache) => {
    const bounds = board.getCellBounds({ i: cache.i, j: cache.j });
    const rect = leaflet.rectangle(bounds).addTo(map);

    rect.bindPopup(() => {
      const popupDiv = document.createElement("div");

      // Create a list of all the coins in the cache with clickable identities
      const coinList = cache.coins.map((coin) => `
          <div>
            <a href="#" class="coin-link" data-coin-id="${coin.identity}">${coin.identity}</a>
          </div>
        `).join("");

      popupDiv.innerHTML = `
          <div>Cache at ${cache.i}, ${cache.j} with ${cache.numCoins} coins</div>
          <div>Coins in this cache:</div>
          ${coinList}
          <button id="collect-${cache.i}-${cache.j}">Collect Coin</button>
          <button id="deposit-${cache.i}-${cache.j}">Deposit Coin</button>
        `;

      // Add event listener to center map when a coin is clicked
      popupDiv.querySelectorAll(".coin-link").forEach((coinLink) => {
        coinLink.addEventListener("click", (event) => {
          event.preventDefault(); // Prevent the default anchor behavior

          const coinId = coinLink.getAttribute("data-coin-id");
          if (coinId) {
            console.log(`Coin ${coinId} clicked`);

            const [latLngPart] = coinId.split("#"); // Get the lat:lng part (before #)
            const [lat, lng] = latLngPart.split(":").map(Number); // Split the lat:lng and convert to numbers

            // Center the map on the cache based on its coordinates
            map.setView(
              leaflet.latLng(lat * TILE_DEGREES, lng * TILE_DEGREES),
              GAMEPLAY_ZOOM_LEVEL, // Optionally set the zoom level you want for cache view
            );
          }
        });
      });

      // Collect Coin button functionality
      popupDiv.querySelector<HTMLButtonElement>(
        `#collect-${cache.i}-${cache.j}`,
      )?.addEventListener("click", () => {
        if (cache.numCoins > 0) {
          const coin = cache.collectCoin();
          if (coin) {
            playerInventory.collect(coin); // Add to inventory
            statusPanel.innerHTML = `Coins: ${playerInventory.coins.length}`;
            board.saveCacheState(cache); // Save updated cache state

            popupDiv.innerHTML = `
                <div>Cache at ${cache.i}, ${cache.j} with ${cache.numCoins} coins</div>
                <div>Coins in this cache:</div>
                ${
              cache.coins.map((coin) => `<div>Coin ${coin.identity}</div>`)
                .join("")
            }
              `;
          }
        }
      });

      // Deposit Coin button functionality
      popupDiv.querySelector<HTMLButtonElement>(
        `#deposit-${cache.i}-${cache.j}`,
      )?.addEventListener("click", () => {
        // Check if the player has any coins in their inventory
        if (playerInventory.coins.length > 0) {
          // Pop a coin from the player's inventory
          const coinToDeposit = playerInventory.coins.pop();

          if (coinToDeposit) {
            // Push the popped coin into the cache
            cache.depositCoin(coinToDeposit);
            statusPanel.innerHTML = `Coins: ${playerInventory.coins.length}`; // Decrease the displayed coin count for the player

            // Save the updated cache state
            board.saveCacheState(cache);

            // Update the popup with the new cache information
            popupDiv.innerHTML = `
                <div>Cache at ${cache.i}, ${cache.j} with ${cache.numCoins} coins</div>
                <div>Coins in this cache:</div>
                ${
              cache.coins.map((coin) => `<div>Coin ${coin.identity}</div>`)
                .join("")
            }
              `;
          }
        } else {
          alert("No coins available to deposit.");
        }
      });

      return popupDiv;
    });
  });
}

const movementPath = leaflet.polyline([player.location], {
  color: "blue",
  weight: 3,
}).addTo(map);

function updateMapUI(player: Player) {
  playerMarker.setLatLng(player.location); // Update player marker
  movementPath.addLatLng(player.location); // Add to polyline
}

function saveGameState() {
  const gameState = {
    playerlocation: { lat: player.location.lat, lng: player.location.lng },
    inventory: playerInventory.coins,
    boardState: board.exportState(), // Save board state
    movementPath: movementPath.getLatLngs(), // Save movement path
  };

  localStorage.setItem("gameState", JSON.stringify(gameState));
  console.log("Game state saved!");
}

function loadGameState() {
  const savedState = localStorage.getItem("gameState");

  if (savedState) {
    const gameState = JSON.parse(savedState);

    // Restore player location
    player.location = leaflet.latLng(
      gameState.playerlocation.lat,
      gameState.playerlocation.lng,
    );
    playerMarker.setLatLng(player.location);
    map.setView(player.location, GAMEPLAY_ZOOM_LEVEL);

    // Restore inventory
    playerInventory.coins = gameState.inventory;

    // Restore board state
    board.importState(gameState.boardState); // Use the board's importState method

    // Restore movement path
    movementPath.setLatLngs(gameState.movementPath);

    console.log("Game state restored!");
  } else {
    console.log("No saved game state found.");
  }
}

function resetGameState() {
  // Clear localStorage
  localStorage.removeItem("gameState");

  // Reset player location to the initial value
  player.location = leaflet.latLng(36.98949379578401, -122.06277128548504);
  playerMarker.setLatLng(player.location);
  map.setView(player.location, GAMEPLAY_ZOOM_LEVEL);

  // Reset player inventory
  playerInventory.coins = [];

  // Reset the board state
  board.importState([]); // Pass an empty state to clear the board

  // Clear the movement path
  movementPath.setLatLngs([player.location]);

  // Clear status panel
  const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
  statusPanel.innerHTML = "Num Coins: 0";

  // Reinitialize caches around the player
  spawnCache();

  console.log("Game state reset!");
}

// Load the game state when the document is ready
document.addEventListener("DOMContentLoaded", loadGameState);

function movePlayer(direction: "north" | "south" | "west" | "east") {
  player.move(direction);
  updateMapUI(player); // Handle UI updates
  spawnCache(); // Handle unrelated logic for now (decouple later if possible)
  saveGameState(); // Optional: Keep automatic saves for convenience
}

document.querySelector("#north")?.addEventListener(
  "click",
  () => movePlayer("north"),
);
document.querySelector("#south")?.addEventListener(
  "click",
  () => movePlayer("south"),
);
document.querySelector("#west")?.addEventListener(
  "click",
  () => movePlayer("west"),
);
document.querySelector("#east")?.addEventListener(
  "click",
  () => movePlayer("east"),
);

document.querySelector("#sensor")?.addEventListener("click", () => {
  if (!navigator.geolocation) {
    alert("Geolocation is not supported by your browser.");
    return;
  }

  if (!isSensorActive) {
    // Enable automatic geolocation updates
    watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const currentLocation = leaflet.latLng(latitude, longitude);
        map.setView(currentLocation, GAMEPLAY_ZOOM_LEVEL); // Center map
        playerMarker.setLatLng(currentLocation); // Update player marker
        player.location = currentLocation; // Update player's location in the game
        spawnCache();
      },
      (error) => {
        alert(`Error accessing GPS: ${error.message}`);
      },
      {
        enableHighAccuracy: true, // Use high accuracy if available
        maximumAge: 0, // Do not use cached position
      },
    );

    isSensorActive = true;
    alert("Geolocation tracking enabled!");
  } else {
    // Disable geolocation updates
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }
    isSensorActive = false;
    alert("Geolocation tracking disabled.");
  }
});

document.querySelector("#reset")?.addEventListener("click", () => {
  const confirmReset = confirm("Are you sure you want to reset the game?");
  if (confirmReset) {
    resetGameState();
  }
});

spawnCache();
