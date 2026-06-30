function getConfiguredBaseUrl() {
  return import.meta.env.BASE_URL || "/";
}

function normalizeBase(baseUrl: string) {
  const withLeadingSlash = baseUrl.startsWith("/") ? baseUrl : `/${baseUrl}`;
  const withoutTrailingSlash = withLeadingSlash.replace(/\/+$/, "");
  return withoutTrailingSlash === "" ? "" : withoutTrailingSlash;
}

function normalizePath(path: string) {
  const withLeadingSlash = path.startsWith("/") ? path : `/${path}`;
  const withoutTrailingSlash = withLeadingSlash.replace(/\/+$/, "");
  return withoutTrailingSlash === "" ? "/" : withoutTrailingSlash;
}

function isPassThroughHref(path: string) {
  return path.startsWith("#") || /^[a-z][a-z0-9+.-]*:/i.test(path);
}

export function withBase(path: string, baseUrl = getConfiguredBaseUrl()) {
  if (!path) return normalizeBase(baseUrl) || "/";
  if (isPassThroughHref(path)) return path;

  const base = normalizeBase(baseUrl);
  const normalizedPath = normalizePath(path);

  if (normalizedPath === "/") return base ? `${base}/` : "/";
  if (base && normalizedPath === base) return path.endsWith("/") ? `${base}/` : normalizedPath;
  if (base && normalizedPath.startsWith(`${base}/`)) return normalizedPath;

  return `${base}${normalizedPath}`;
}

export function getPathWithoutBase(pathname: string, baseUrl = getConfiguredBaseUrl()) {
  const base = normalizeBase(baseUrl);
  const normalizedPath = normalizePath(pathname);

  if (!base) return normalizedPath;
  if (normalizedPath === base) return "/";
  if (normalizedPath.startsWith(`${base}/`)) {
    return normalizePath(normalizedPath.slice(base.length));
  }

  return normalizedPath;
}
