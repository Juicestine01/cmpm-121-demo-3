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

let playerLocation = leaflet.latLng(36.98949379578401, -122.06277128548504);
const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const NEIGHBORHOOD_SIZE = 8;
const CACHE_SPAWN_PROBABILITY = 0.1;

const map = leaflet.map(document.getElementById("map")!, {
  center: playerLocation,
  zoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: false,
  scrollWheelZoom: false,
});

leaflet.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution:
    '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
}).addTo(map);

const playerMarker = leaflet.marker(playerLocation).addTo(map);
playerMarker.bindPopup(() => {
  const popupDiv1 = document.createElement("div");
  popupDiv1.innerHTML = `<div>${board.getCellForPoint(playerLocation)}</div>`;
  return popupDiv1;
});

export interface Coins {
  serial: number; // Unique identifier for each coin
  identity: string; // Unique identity based on cache
  cell: { i: number; j: number }; // Coordinates of the cache where the coin originated
}

interface Cache {
  coins: Coins[];
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
  const visibleCaches = board.getCellsNearPoint(playerLocation);

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

      // Create a list of all the coins in the cache
      const coinList = cache.coins.map((coin) => `
              <div>Coin ${coin.identity}</div>
            `).join("");

      popupDiv.innerHTML = `
                <div>Cache at ${cache.i}, ${cache.j} with ${cache.numCoins} coins</div>
                <div>Coins in this cache:</div>
                ${coinList}
                <button id="collect-${cache.i}-${cache.j}">Collect Coin</button>
                <button id="deposit-${cache.i}-${cache.j}">Deposit Coin</button>
            `;

      // Collect Coin button functionality
      popupDiv.querySelector<HTMLButtonElement>(
        `#collect-${cache.i}-${cache.j}`,
      )
        ?.addEventListener("click", () => {
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
      )
        ?.addEventListener("click", () => {
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

function movePlayer(direction: "north" | "south" | "west" | "east") {
  const delta = TILE_DEGREES;
  switch (direction) {
    case "north":
      playerLocation = leaflet.latLng(
        playerLocation.lat + delta,
        playerLocation.lng,
      );
      break;
    case "south":
      playerLocation = leaflet.latLng(
        playerLocation.lat - delta,
        playerLocation.lng,
      );
      break;
    case "west":
      playerLocation = leaflet.latLng(
        playerLocation.lat,
        playerLocation.lng - delta,
      );
      break;
    case "east":
      playerLocation = leaflet.latLng(
        playerLocation.lat,
        playerLocation.lng + delta,
      );
      break;
  }
  playerMarker.setLatLng(playerLocation);
  spawnCache();
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

spawnCache();
