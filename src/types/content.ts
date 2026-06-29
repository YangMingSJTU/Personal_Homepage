export type ProductStatus = "Live" | "Beta" | "Building" | "Idea" | "Archived";

export type ProjectStatus = "Active" | "Completed" | "Archived";

export type Product = {
  id: string;
  name: string;
  description: string;
  problem?: string;
  status: ProductStatus;
  category: string[];
  url?: string;
  repo?: string;
  featured: boolean;
  tech: string[];
};

export type Project = {
  id: string;
  title: string;
  summary: string;
  background?: string;
  category: string;
  status: ProjectStatus;
  tech: string[];
  links: {
    demo?: string;
    github?: string;
    caseStudy?: string;
  };
  result?: string;
  featured: boolean;
  coordinate: string;
};

export type Profile = {
  name: string;
  labName: string;
  headline: string;
  subtitle: string;
  bio: string;
  email: string;
  focus: string[];
  principles: string[];
  skills: string[];
  socials: {
    github?: string;
    x?: string;
    telegram?: string;
  };
};
