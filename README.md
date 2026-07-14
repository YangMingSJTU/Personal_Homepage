# Personal Homepage

Personal Homepage is a static portfolio site built around a dynamic Go-board hero, minimal entry points, products, projects, and contact links.

## Tech Stack

- Astro for static pages and build output.
- Tailwind CSS for the visual system.
- React islands for small interactive components.
- Vitest and Playwright for tests.

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:4321`.

## Quality Checks

```bash
npm test
npm run build
npm run test:e2e
npm run perf:homepage
```

`npm run test:e2e` builds the static site and verifies it through Astro preview with Playwright.
Run `npm run perf:homepage` while the preview server is active to report homepage FPS, frame-time percentiles, long tasks, and transition duration. Set `PERF_URL` to profile another local URL.

## Content Updates

Edit the JSON files under `src/data/`:

- `profile.json` for personal profile and contact links.
- `products.json` for product cards and launch links.
- `projects.json` for project cards and proof-of-work links.

## Render Deployment

Use Render Static Site:

```text
Build Command: npm install && npm run build
Publish Directory: dist
```

Update `astro.config.mjs` and `public/robots.txt` with the production domain before launch.
