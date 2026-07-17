# Changelog

All notable changes to KnowFlow are documented here. This project follows
[Semantic Versioning](https://semver.org/).

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

[0.2.0]: https://github.com/jerryjiao/knowflow/compare/d0ff6f4...v0.2.0
[0.1.0]: https://github.com/jerryjiao/knowflow/commit/d0ff6f4
