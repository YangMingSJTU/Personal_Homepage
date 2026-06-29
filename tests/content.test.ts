import { describe, expect, it } from "vitest";
import { getFeaturedProducts, getPrimaryProductAction } from "@/lib/content";
import { getProductStatusMeta } from "@/lib/status";
import type { Product } from "@/types/content";

const products: Product[] = [
  {
    id: "ai-news-system",
    name: "AI News System",
    description: "自动聚合、筛选并推送 AI 领域重要动态。",
    status: "Beta",
    category: ["AI", "Automation"],
    url: "https://example.com/ai-news",
    repo: "",
    featured: true,
    tech: ["Astro", "RSS"]
  },
  {
    id: "learning-agent",
    name: "Learning Agent",
    description: "从学习材料中生成结构化复盘。",
    status: "Live",
    category: ["AI", "Learning"],
    url: "https://example.com/learning",
    repo: "",
    featured: true,
    tech: ["LLM"]
  },
  {
    id: "idea-lab",
    name: "Idea Lab",
    description: "记录正在验证的产品想法。",
    status: "Idea",
    category: ["Tool"],
    url: "",
    repo: "",
    featured: true,
    tech: []
  },
  {
    id: "archive",
    name: "Archive",
    description: "旧实验归档。",
    status: "Archived",
    category: ["Web"],
    url: "",
    repo: "",
    featured: false,
    tech: []
  }
];

describe("content helpers", () => {
  it("limits featured products while preserving editorial order", () => {
    expect(getFeaturedProducts(products, 2).map((product) => product.id)).toEqual([
      "ai-news-system",
      "learning-agent"
    ]);
  });

  it("degrades missing product links to a disabled coming-soon action", () => {
    expect(getPrimaryProductAction(products[2])).toEqual({
      label: "Coming Soon",
      href: undefined,
      disabled: true
    });
  });
});

describe("status metadata", () => {
  it("maps product status to text plus a non-color visual marker", () => {
    expect(getProductStatusMeta("Beta")).toMatchObject({
      label: "Beta",
      stone: "white",
      ariaLabel: "Product status: Beta"
    });
  });
});
