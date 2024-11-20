import leaflet from "leaflet";
import luck from "./luck.ts";

import { Coins } from "./main.ts";

export interface Momento<T> {
  toMomento(): T;
  fromMomento(momento: T): void;
}

export class Geocache implements Momento<string> {
  i: number;
  j: number;
  coins: Coins[]; // Use Coin interface for coins

  constructor(i: number, j: number, numCoins: number = 0) {
    this.i = i;
    this.j = j;
    this.coins = Array.from({ length: numCoins }, (_, serial) => ({
      serial,
      identity: `${i}:${j}#${serial}`, // Unique identity
      cell: { i, j }, // Store cache coordinates
    }));
  }

  // Getter for numCoins based on the coins array length
  get numCoins(): number {
    return this.coins.length;
  }

  toMomento(): string {
    return JSON.stringify(this.coins);
  }

  fromMomento(momento: string): void {
    this.coins = JSON.parse(momento);
  }

  collectCoin(): Coins | null {
    return this.coins.pop() || null; // Remove and return the last coin
  }

  depositCoin(coin: Coins): void {
    this.coins.push(coin); // Add the coin to the cache
  }
}

export interface Cell {
  readonly i: number;
  readonly j: number;
}

export class Board {
  readonly tileWidth: number;
  readonly tileVisibilityRadius: number;
  readonly cacheSpawnProb: number;

  private readonly knownCells: Map<string, Cell>;
  private readonly mementoMap: Map<string, string>; // Store cache states

  constructor(
    tileWidth: number,
    tileVisibilityRadius: number,
    cacheSpawnProb: number,
  ) {
    this.tileWidth = tileWidth;
    this.tileVisibilityRadius = tileVisibilityRadius;
    this.cacheSpawnProb = cacheSpawnProb;
    this.knownCells = new Map<string, Cell>();
    this.mementoMap = new Map<string, string>();
  }

  private getCanonicalCell(cell: Cell): Cell {
    const { i, j } = cell;
    const key = [i, j].toString();
    if (!this.knownCells.has(key)) { // check if key is in knownCells if not then add else return
      this.knownCells.set(key, cell);
    }
    return this.knownCells.get(key)!;
  }

  getCellForPoint(point: leaflet.LatLng): Cell {
    const i = Math.floor((point.lat) / this.tileWidth);
    const j = Math.floor((point.lng) / this.tileWidth);
    return this.getCanonicalCell({
      i,
      j,
    });
  }

  getCacheKey(i: number, j: number): string {
    return `${i},${j}`;
  }

  createOrRestoreCache(cell: Cell): Geocache {
    const key = this.getCacheKey(cell.i, cell.j);
    const savedState = this.mementoMap.get(key);

    if (savedState) {
      const cache = new Geocache(cell.i, cell.j);
      cache.fromMomento(savedState);
      return cache;
    }
    const numCoins = Math.floor(luck([cell.i, cell.j].toString()) * 100) + 1; // Random 1-10 coins

    const newCache = new Geocache(cell.i, cell.j, numCoins);
    this.mementoMap.set(key, newCache.toMomento());
    return newCache;
  }

  saveCacheState(cache: Geocache): void {
    const key = this.getCacheKey(cache.i, cache.j);
    this.mementoMap.set(key, cache.toMomento());
  }

  getCellBounds(cell: Cell): leaflet.LatLngBounds {
    return leaflet.latLngBounds([
      [cell.i * this.tileWidth, cell.j * this.tileWidth], // Borrowed code from example.ts
      [(cell.i + 1) * this.tileWidth, (cell.j + 1) * this.tileWidth],
    ]);
  }

  getCellsNearPoint(point: leaflet.LatLng): Geocache[] { // More code borrowed from example.ts randomly spawn and outline cells around starting
    const originCell = this.getCellForPoint(point);
    const visibleCaches: Geocache[] = [];

    for (
      let di = -this.tileVisibilityRadius;
      di <= this.tileVisibilityRadius;
      di++
    ) {
      for (
        let dj = -this.tileVisibilityRadius;
        dj <= this.tileVisibilityRadius;
        dj++
      ) {
        const cell = this.getCanonicalCell({
          i: originCell.i + di,
          j: originCell.j + dj,
        });

        if (luck(this.getCacheKey(cell.i, cell.j)) < this.cacheSpawnProb) {
          const cache = this.createOrRestoreCache(cell);
          visibleCaches.push(cache);
        }
      }
    }

    return visibleCaches;
  }
  // Export the state of mementoMap as an array of key-value pairs
  exportState(): [string, string][] {
    return Array.from(this.mementoMap.entries());
  }

  // Import state back into mementoMap
  importState(state: [string, string][]): void {
    this.mementoMap.clear();
    state.forEach(([key, value]) => {
      this.mementoMap.set(key, value);
    });
  }
}
