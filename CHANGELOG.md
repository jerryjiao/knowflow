# Changelog

All notable changes to KnowFlow are documented here. This project follows
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Bilingual documentation website (Astro + Starlight) under `site/`, deployed to
  GitHub Pages via GitHub Actions. English landing at `/`, Chinese at `/zh/`,
  docs under `/en/` and `/zh/` with browser-language auto-switch.

## [0.3.0] - 2026-08-18

### Added

- First npm release, published as the scoped package `@jerryjiao/knowflow`
  (npm considers the bare name too similar to the existing `know-flow`
  package). Install with `npm install -g @jerryjiao/knowflow`; the CLI
  command is still `knowflow`.
- `knowflow tags` builds and prunes `tag/<name>.md` hub pages from `[[tag/<name>]]`
  links, linking back to every tagged page. Re-running is idempotent.
- `health.excludeOrphanDirs` configuration lists directories whose pages are
  expected to be unreferenced (daily-sync feeds, inboxes) and should not count
  as isolated pages.

### Fixed

- Link extraction missed every wikilink after the first one on a line, so
  index-style pages that put dozens of links on a single line silently dropped
  most of their references and produced mass false orphan reports.
- Markdown link extraction captured a leading `(` into the target path.
- `knowflow health` exited with code 0 even when it found issues, hiding
  failures from cron and CI wrappers.

### Changed

- Both READMEs make the source checkout the primary install path until the
  npm package is published, instead of an `npx` command that 404s.

## [0.2.1] - 2026-08-10

### Added

- `knowflow fix [--dry-run]` repairs issues the health check surfaces: cleans empty
  `[[entities/,]]` / `[[concepts/,]]` links, creates missing entity/concept pages,
  pads files below the minimum size, and auto-links orphan pages to `index.md`.
  `--dry-run` reports what would change without writing.

### Fixed

- `wiki-auto-fix.sh` (now backing `knowflow fix`) honored `--dry-run` for the
  empty-link cleanup but still created, padded, and orphan-linked files in
  dry-run mode because shell redirections ran before the dry-run guard. All
  three write paths now short-circuit under `--dry-run` and `\n` escapes in the
  pad suffix render as real newlines.

## [0.2.0] - 2026-07-17

### Added

- `knowflow init [directory]` now creates a standalone project, its JSON configuration,
  Wiki/raw/graph directories, starter index, and editable templates.
- Core CLI tests using Node's built-in test runner and a GitHub Actions workflow.
- npm publishing metadata and an explicit package file allowlist.
- English and Simplified Chinese project guides, a runnable text-to-graph example,
  contributor and security policies, and structured GitHub issue forms.

### Changed

- Commands resolve project paths from the nearest `.knowflowrc` and support custom
  Wiki, raw, and graph locations.
- External commands use argument arrays instead of interpolated shell strings.
- Graph, ingestion, bookmark, health, and vector scripts use portable project paths.

### Fixed

- Fixed the undefined graph Wiki path and browser launcher in the CLI.
- Fixed a syntax error and ESM compatibility in `enrich-wiki.js`.
- Removed machine-specific paths from graph scripts.

## [0.1.0] - 2026-04-28

- Initial open-source release.

[0.2.1]: https://github.com/jerryjiao/knowflow/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/jerryjiao/knowflow/compare/d0ff6f4...v0.2.0
[0.1.0]: https://github.com/jerryjiao/knowflow/commit/d0ff6f4
