import { describe, expect, test } from "vitest";
import {
  canPlaceStone,
  getCapturedOpponentKeys,
  getRandomPlacementMode,
  getVisibleOccupancy,
  stoneKey,
  type BoardStone,
  type VisibleBounds
} from "../src/components/home/goRules";

function stone(x: number, y: number, color: "black" | "white"): BoardStone {
  return { x, y, color, source: "user", createdAt: 1 };
}

function board(stones: BoardStone[]) {
  return new Map(stones.map((item) => [stoneKey(item.x, item.y), item]));
}

describe("goRules", () => {
  test("captures a single opponent stone when its last liberty is filled", () => {
    const stones = board([
      stone(0, 0, "white"),
      stone(1, 0, "black"),
      stone(-1, 0, "black"),
      stone(0, 1, "black"),
      stone(0, -1, "black")
    ]);

    expect(getCapturedOpponentKeys(stones, stone(0, -1, "black"))).toEqual([stoneKey(0, 0)]);
  });

  test("captures a connected opponent group only when the whole group has no liberties", () => {
    const stones = board([
      stone(0, 0, "white"),
      stone(1, 0, "white"),
      stone(-1, 0, "black"),
      stone(0, -1, "black"),
      stone(0, 1, "black"),
      stone(1, -1, "black"),
      stone(1, 1, "black"),
      stone(2, 0, "black")
    ]);

    expect(getCapturedOpponentKeys(stones, stone(2, 0, "black")).sort()).toEqual(
      [stoneKey(0, 0), stoneKey(1, 0)].sort()
    );
  });

  test("does not capture an opponent group that still has a liberty", () => {
    const stones = board([
      stone(0, 0, "white"),
      stone(1, 0, "white"),
      stone(-1, 0, "black"),
      stone(0, -1, "black"),
      stone(0, 1, "black"),
      stone(1, -1, "black"),
      stone(2, 0, "black")
    ]);

    expect(getCapturedOpponentKeys(stones, stone(2, 0, "black"))).toEqual([]);
  });

  test("rejects placement on occupied intersections", () => {
    const stones = board([stone(0, 0, "black")]);

    expect(canPlaceStone(stones, 0, 0)).toBe(false);
    expect(canPlaceStone(stones, 1, 0)).toBe(true);
  });

  test("returns density modes for low, medium, and high visible occupancy", () => {
    const bounds: VisibleBounds = { minX: 0, maxX: 2, minY: 0, maxY: 2 };

    expect(getRandomPlacementMode(getVisibleOccupancy(board([stone(0, 0, "black")]), bounds).occupancy)).toBe(
      "normal"
    );
    expect(
      getRandomPlacementMode(
        getVisibleOccupancy(board([stone(0, 0, "black"), stone(1, 0, "white"), stone(2, 0, "black")]), bounds)
          .occupancy
      )
    ).toBe("throttled");
    expect(
      getRandomPlacementMode(
        getVisibleOccupancy(
          board([
            stone(0, 0, "black"),
            stone(1, 0, "white"),
            stone(2, 0, "black"),
            stone(0, 1, "white"),
            stone(1, 1, "black")
          ]),
          bounds
        ).occupancy
      )
    ).toBe("paused");
  });
});
