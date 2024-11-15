// Imports
import leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";
import "./leafletWorkaround.ts";
import luck from "./luck.ts";
import { Board, Cell } from "./board.ts";

// DOM and gameplay setup
const app = document.querySelector<HTMLDivElement>("#app")!;
const button = document.createElement("button");
button.innerHTML = "click me!";
button.addEventListener("click", () => alert("You clicked the button!"));
app.append(button);

const playerLocation = leaflet.latLng(36.98949379578401, -122.06277128548504);
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

interface Coins {
  cell: Cell;
  serial: number;
}

interface Cache {
  coins: Coins[];
}

interface Inventory {
  coins: Coins[];
  collect(coin: Coins): void;
  deposit(coin: Coins): void;
}

// Creating inventory that holds coins
const playerInventory: Inventory = {
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

let coins = 0;
const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
statusPanel.innerHTML = "Num Coins: 0";

// Instantiate the board with gameplay parameters
const board = new Board(
  TILE_DEGREES,
  NEIGHBORHOOD_SIZE,
  CACHE_SPAWN_PROBABILITY,
);

function spawnCache(cell: Cell) {
  const bounds = board.getCellBounds(cell);
  const rect = leaflet.rectangle(bounds).addTo(map);

  // Generate a random number of coins for this cache
  const numCoins = Math.floor(luck([cell.i, cell.j].toString()) * 100); // 1-5 coins
  const cache: Cache = {
    coins: Array.from({ length: numCoins }, (_, serial) => ({ cell, serial })),
  };

  rect.bindPopup(() => {
    let totalCoins = cache.coins.length;

    function renderCoinList() {
      return cache.coins
        .map((coin) =>
          `<div>${coin.cell.i}, ${coin.cell.j}: Coin ${coin.serial}</div>`
        )
        .join("");
    }

    const popupDiv = document.createElement("div");
    popupDiv.innerHTML = `
        <div>There is a cache here at "${cell.i},${cell.j}". It has <span id="coin-count">${totalCoins}</span> coins.</div>
        <div><strong>Coins:</strong></div>
        <div id="coin-list">${renderCoinList()}</div> <!-- List of coins -->
        <button id="collect">Collect Coin</button> 
        <button id="deposit">Deposit Coin</button>`;

    function collect() {
      if (cache.coins.length > 0) {
        const coinToCollect = cache.coins.pop()!; // Remove a coin from the cache
        playerInventory.collect(coinToCollect); // Add it to the player inventory
        coins++;
        totalCoins = cache.coins.length; // Update the coin count
        statusPanel.innerHTML = `Num Coins: ${coins}`;

        // Update the display of the coin list and count
        popupDiv.querySelector<HTMLDivElement>("#coin-list")!.innerHTML =
          renderCoinList();
        popupDiv.querySelector<HTMLSpanElement>("#coin-count")!.innerHTML =
          `${totalCoins}`;
      }
    }

    function deposit() {
      if (playerInventory.coins.length > 0) {
        const coinToDeposit = playerInventory.coins.pop()!; // Remove a coin from the inventory
        cache.coins.push(coinToDeposit); // Add it back to the cache
        coins--;
        totalCoins = cache.coins.length; // Update the coin count
        statusPanel.innerHTML = `Num Coins: ${coins}`;

        // Update the display of the coin list and count
        popupDiv.querySelector<HTMLDivElement>("#coin-list")!.innerHTML =
          renderCoinList();
        popupDiv.querySelector<HTMLSpanElement>("#coin-count")!.innerHTML =
          `${totalCoins}`;
      }
    }

    popupDiv.querySelector<HTMLButtonElement>("#collect")!.addEventListener(
      "click",
      collect,
    );
    popupDiv.querySelector<HTMLButtonElement>("#deposit")!.addEventListener(
      "click",
      deposit,
    );
    return popupDiv;
  });
}

// Use board to get cells near the player and spawn caches
const cellsToSpawn = board.getCellsNearPoint(playerLocation);
cellsToSpawn.forEach((cell) => spawnCache(cell));
