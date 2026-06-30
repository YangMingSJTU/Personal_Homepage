import { describe, expect, it } from "vitest";
import { getPathWithoutBase, withBase } from "@/lib/sitePath";

describe("site path helpers", () => {
  it("prefixes internal root paths with the configured base", () => {
    expect(withBase("/projects", "/Personal_Homepage/")).toBe("/Personal_Homepage/projects");
    expect(withBase("/", "/Personal_Homepage/")).toBe("/Personal_Homepage/");
    expect(withBase("images/avatar-holy-grail.png", "/Personal_Homepage/")).toBe(
      "/Personal_Homepage/images/avatar-holy-grail.png"
    );
  });

  it("keeps local root paths clean when base is slash", () => {
    expect(withBase("/about", "/")).toBe("/about");
    expect(withBase("/", "/")).toBe("/");
  });

  it("does not duplicate an existing base prefix", () => {
    expect(withBase("/Personal_Homepage/about", "/Personal_Homepage/")).toBe("/Personal_Homepage/about");
    expect(withBase("/Personal_Homepage/", "/Personal_Homepage/")).toBe("/Personal_Homepage/");
  });

  it("does not rewrite external, mail, telephone, or hash links", () => {
    expect(withBase("https://github.com/YangMingSJTU/Personal_Homepage", "/Personal_Homepage/")).toBe(
      "https://github.com/YangMingSJTU/Personal_Homepage"
    );
    expect(withBase("mailto:hello@example.com", "/Personal_Homepage/")).toBe("mailto:hello@example.com");
    expect(withBase("tel:+10000000000", "/Personal_Homepage/")).toBe("tel:+10000000000");
    expect(withBase("#main-view", "/Personal_Homepage/")).toBe("#main-view");
  });

  it("normalizes current paths for active navigation under a GitHub Pages base", () => {
    expect(getPathWithoutBase("/Personal_Homepage/projects", "/Personal_Homepage/")).toBe("/projects");
    expect(getPathWithoutBase("/Personal_Homepage/", "/Personal_Homepage/")).toBe("/");
    expect(getPathWithoutBase("/projects", "/")).toBe("/projects");
  });
});
