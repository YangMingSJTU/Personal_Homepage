import type { ProductStatus, ProjectStatus } from "@/types/content";

export type ProductStatusMeta = {
  label: ProductStatus;
  stone: "black" | "white" | "ghost" | "ring" | "muted";
  tone: "live" | "beta" | "building" | "idea" | "archived";
  ariaLabel: string;
};

const productStatusMap: Record<ProductStatus, ProductStatusMeta> = {
  Live: {
    label: "Live",
    stone: "black",
    tone: "live",
    ariaLabel: "Product status: Live"
  },
  Beta: {
    label: "Beta",
    stone: "white",
    tone: "beta",
    ariaLabel: "Product status: Beta"
  },
  Building: {
    label: "Building",
    stone: "ghost",
    tone: "building",
    ariaLabel: "Product status: Building"
  },
  Idea: {
    label: "Idea",
    stone: "ring",
    tone: "idea",
    ariaLabel: "Product status: Idea"
  },
  Archived: {
    label: "Archived",
    stone: "muted",
    tone: "archived",
    ariaLabel: "Product status: Archived"
  }
};

export function getProductStatusMeta(status: ProductStatus): ProductStatusMeta {
  return productStatusMap[status];
}

export function getProjectStatusTone(status: ProjectStatus): "live" | "building" | "archived" {
  if (status === "Completed") return "live";
  if (status === "Active") return "building";
  return "archived";
}
