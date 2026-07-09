import { describe, expect, it } from "vitest";
import { introQuotes } from "@/data/introQuotes";

describe("intro quotes", () => {
  it("provides exactly 100 unique local quotes", () => {
    expect(introQuotes).toHaveLength(100);
    expect(new Set(introQuotes).size).toBe(introQuotes.length);
  });

  it("keeps every quote non-empty and compact enough for the intro", () => {
    for (const quote of introQuotes) {
      expect(quote.trim()).toBe(quote);
      expect(quote.length).toBeGreaterThanOrEqual(8);
      expect(quote.length).toBeLessThanOrEqual(80);
    }
  });
});
