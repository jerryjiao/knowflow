# Contributing to KnowFlow

Thanks for helping make agent-native knowledge work more practical. Focused bug fixes, documentation improvements, new source adapters, templates, and reproducible workflow examples are all welcome.

## Before opening a pull request

1. Check existing issues and explain the user problem your change solves.
2. Keep capture and Wiki synthesis conceptually separate: `ingest` saves raw material; a human or agent organizes structured pages.
3. Preserve portable project paths and existing Markdown/configuration formats.
4. Add or update tests for observable CLI behavior.
5. Run the complete local verification suite:

   ```bash
   npm install
   npm run check
   npm test
   npm pack --dry-run
   ```

## Project conventions

- Node.js code uses ES modules unless a script has an explicit compatibility reason.
- Python targets 3.10+ and should include type annotations for new public functions.
- Shell scripts use `set -euo pipefail` and quote path/input variables.
- Commit messages should follow Conventional Commits, such as `feat:`, `fix:`, or `docs:`.
- Never commit API keys, `.env` files, captured private content, or machine-specific absolute paths.

## Useful starting points

| Goal | File or directory |
| --- | --- |
| Change CLI behavior | `bin/knowflow.js` |
| Change capture behavior | `scripts/ingest.sh` |
| Change graph generation | `scripts/graph_builder.py` |
| Change Wiki templates | `templates/` |
| Understand the architecture | `docs/architecture/system-architecture.md` |
| Understand the data model | `docs/reference/data-model.md` |

For the longer Chinese contributor guide, see [docs/contributing.md](docs/contributing.md). Please report vulnerabilities according to [SECURITY.md](SECURITY.md), not in a public issue.

By contributing, you agree that your contribution will be licensed under the repository's [MIT License](LICENSE).
