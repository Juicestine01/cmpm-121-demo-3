import leaflet from "leaflet";
import luck from "./luck.ts";

export interface Cell {
  readonly i: number;
  readonly j: number;
}

export class Board {
  readonly tileWidth: number;
  readonly tileVisibilityRadius: number;
  readonly cacheSpawnProb: number;

  private readonly knownCells: Map<string, Cell>;

  constructor(
    tileWidth: number,
    tileVisibilityRadius: number,
    cacheSpawnProb: number,
  ) {
    this.tileWidth = tileWidth;
    this.tileVisibilityRadius = tileVisibilityRadius;
    this.cacheSpawnProb = cacheSpawnProb;
    this.knownCells = new Map<string, Cell>();
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

  getCellBounds(cell: Cell): leaflet.LatLngBounds {
    return leaflet.latLngBounds([
      [cell.i * this.tileWidth, cell.j * this.tileWidth], // Borrowed code from example.ts
      [(cell.i + 1) * this.tileWidth, (cell.j + 1) * this.tileWidth],
    ]);
  }

  getCellsNearPoint(point: leaflet.LatLng): Cell[] { // More code borrowed from example.ts randomly spawn and outline cells around starting
    const resultCells: Cell[] = [];
    const originCell = this.getCellForPoint(point);
    for (
      let di = -this.tileVisibilityRadius;
      di < this.tileVisibilityRadius;
      di++
    ) {
      for (
        let dj = -this.tileVisibilityRadius;
        dj < this.tileVisibilityRadius;
        dj++
      ) {
        if (
          luck([originCell.i + di, originCell.j + dj].toString()) <
            this.cacheSpawnProb
        ) {
          const cell = this.getCanonicalCell({
            i: originCell.i + di,
            j: originCell.j + dj,
          });
          resultCells.push(cell);
        }
      }
    }
    return resultCells;
  }
}
