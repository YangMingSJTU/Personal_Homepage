import type { Product, Project } from "@/types/content";

export type ProductAction = {
  label: "Launch" | "Coming Soon";
  href?: string;
  disabled: boolean;
};

export function getFeaturedProducts(products: Product[], limit = 3): Product[] {
  return products.filter((product) => product.featured).slice(0, limit);
}

export function getFeaturedProjects(projects: Project[], limit = 3): Project[] {
  return projects.filter((project) => project.featured).slice(0, limit);
}

export function getPrimaryProductAction(product: Product): ProductAction {
  if (product.url) {
    return {
      label: "Launch",
      href: product.url,
      disabled: false
    };
  }

  return {
    label: "Coming Soon",
    href: undefined,
    disabled: true
  };
}
