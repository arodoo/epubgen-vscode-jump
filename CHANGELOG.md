# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.1] - 2026-08-20

### Added

- `Alt+M` — jump to next git change at character precision
- `Alt+N` — jump to previous git change at character precision
- Gutter arrows reusing VS Code codicons (`arrow-down`, `arrow-up`) as data URIs
- Overview ruler stripes (`editorOverviewRuler.modifiedForeground`) for right-side visual presence
- Status bar feedback: `cambio N / M` for 2.5s after each jump
- 46 unit tests in `test/diffCore.test.ts` covering the core algorithm
- Line-level deduplication: one nav point per changed line
- CRLF/LF normalization: ignores `core.autocrlf` line-ending mismatch to avoid spurious nav points
- Offset→Position mapping from normalized text (LF) back to actual document coordinates (CRLF)
- `git show HEAD:path` integration with fallback to `:0:path` for staged-but-uncommitted changes
- vsce packaging pipeline (`npx vsce package --allow-missing-repository`)
- esbuild bundling with sourcemaps

### Notes

- Keybindings fire globally (no `editorTextFocus` clause) so `Alt+M/N` work without first clicking inside the editor
- Vsce `publisher` field is `local` — placeholder for future Marketplace publish (would need a real publisher ID)
