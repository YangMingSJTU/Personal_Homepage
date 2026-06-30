export type StoneColor = "black" | "white";
export type StoneSource = "user" | "random";
export type RandomPlacementMode = "normal" | "throttled" | "paused";

export type GridPoint = {
  x: number;
  y: number;
};

export type BoardStone = GridPoint & {
  color: StoneColor;
  source: StoneSource;
  createdAt: number;
};

export type VisibleBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

export type VisibleOccupancy = {
  visibleStoneCount: number;
  visibleCapacity: number;
  occupancy: number;
};

export function stoneKey(x: number, y: number) {
  return `${x}:${y}`;
}

export function getAdjacentPoints(point: GridPoint): GridPoint[] {
  return [
    { x: point.x + 1, y: point.y },
    { x: point.x - 1, y: point.y },
    { x: point.x, y: point.y + 1 },
    { x: point.x, y: point.y - 1 }
  ];
}

export function canPlaceStone(stones: Map<string, BoardStone>, x: number, y: number) {
  return !stones.has(stoneKey(x, y));
}

export function getGroup(stones: Map<string, BoardStone>, start: GridPoint): BoardStone[] {
  const startStone = stones.get(stoneKey(start.x, start.y));
  if (!startStone) return [];

  const group: BoardStone[] = [];
  const visited = new Set<string>();
  const queue: BoardStone[] = [startStone];

  while (queue.length > 0) {
    const stone = queue.shift();
    if (!stone) break;

    const key = stoneKey(stone.x, stone.y);
    if (visited.has(key)) continue;

    visited.add(key);
    group.push(stone);

    getAdjacentPoints(stone).forEach((neighbor) => {
      const neighborStone = stones.get(stoneKey(neighbor.x, neighbor.y));
      if (neighborStone?.color === startStone.color) {
        queue.push(neighborStone);
      }
    });
  }

  return group;
}

export function getLiberties(stones: Map<string, BoardStone>, group: BoardStone[]) {
  const liberties = new Set<string>();

  group.forEach((stone) => {
    getAdjacentPoints(stone).forEach((neighbor) => {
      const key = stoneKey(neighbor.x, neighbor.y);
      if (!stones.has(key)) {
        liberties.add(key);
      }
    });
  });

  return liberties;
}

export function getCapturedOpponentKeys(stones: Map<string, BoardStone>, placedStone: BoardStone) {
  const opponentColor: StoneColor = placedStone.color === "black" ? "white" : "black";
  const captured = new Set<string>();

  getAdjacentPoints(placedStone).forEach((neighbor) => {
    const neighborKey = stoneKey(neighbor.x, neighbor.y);
    const neighborStone = stones.get(neighborKey);
    if (neighborStone?.color !== opponentColor || captured.has(neighborKey)) return;

    const group = getGroup(stones, neighborStone);
    if (getLiberties(stones, group).size > 0) return;

    group.forEach((stone) => captured.add(stoneKey(stone.x, stone.y)));
  });

  return Array.from(captured);
}

export function getVisibleOccupancy(stones: Map<string, BoardStone>, bounds: VisibleBounds): VisibleOccupancy {
  const width = Math.max(0, bounds.maxX - bounds.minX + 1);
  const height = Math.max(0, bounds.maxY - bounds.minY + 1);
  const visibleCapacity = width * height;
  let visibleStoneCount = 0;

  stones.forEach((stone) => {
    if (stone.x < bounds.minX || stone.x > bounds.maxX || stone.y < bounds.minY || stone.y > bounds.maxY) return;
    visibleStoneCount += 1;
  });

  return {
    visibleStoneCount,
    visibleCapacity,
    occupancy: visibleCapacity === 0 ? 0 : visibleStoneCount / visibleCapacity
  };
}

export function getRandomPlacementMode(occupancy: number): RandomPlacementMode {
  if (occupancy >= 0.5) return "paused";
  if (occupancy >= 1 / 3) return "throttled";
  return "normal";
}
