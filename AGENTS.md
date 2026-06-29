# Repository Guidelines

## Project Structure & Module Organization

This repository is currently minimal, with `README.md` and `LICENSE` at the root. Keep root-level files limited to project metadata and configuration. As the personal homepage grows, use predictable folders:

- `src/` for page source, components, scripts, and styles.
- `assets/` for images, icons, fonts, and other static media.
- `tests/` for automated tests and fixtures.
- `docs/` for design notes or contributor documentation.

Prefer small, purpose-specific files over large mixed-responsibility files.

## Build, Test, and Development Commands

No build or test toolchain is committed yet. Before adding framework-specific commands, document them in `README.md` and keep package scripts stable. Common examples for a future Node-based setup:

- `npm install` installs dependencies from `package-lock.json`.
- `npm run dev` starts the local development server.
- `npm run build` creates the production output.
- `npm test` runs the automated test suite.

If the site remains static HTML/CSS/JS, include an `index.html` entry point and verify changes directly in a browser.

## Coding Style & Naming Conventions

Use 2-space indentation for HTML, CSS, JavaScript, TypeScript, JSON, and Markdown. Name files with lowercase kebab case, such as `about-page.tsx` or `site-header.css`. Use descriptive component and function names. Keep styles close to the feature they support unless a shared style is reused across pages.

For visual work, keep graphics clean, balanced, and proportionate. Include concise explanatory text when diagrams or generated images are added.

## Testing Guidelines

There is no existing test framework. Add tests when introducing interactive behavior, build tooling, or non-trivial rendering logic. Place tests under `tests/` or next to source files using a clear pattern such as `*.test.ts` or `*.spec.ts`. Document the chosen runner and coverage expectations before relying on them in CI.

## Commit & Pull Request Guidelines

Git history currently only contains `Initial commit`, so no established convention exists. Use concise, imperative commit messages, preferably Conventional Commits, for example `feat: add homepage hero` or `docs: add contributor guide`.

Pull requests should include a short summary, testing notes, linked issues when relevant, and screenshots for visual changes. Keep PRs focused so reviewers can validate behavior and design quickly.

## Security & Configuration Tips

Do not commit secrets, private tokens, generated credentials, or local environment files. Keep deployment-specific settings in ignored `.env` files or the hosting provider configuration.
