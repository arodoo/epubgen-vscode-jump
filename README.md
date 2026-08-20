# Jump to Exact Change

Navigate git changes at character precision in VS Code.

[![CI](https://img.shields.io/github/actions/workflow/status/arodoo/epubgen-vscode-jump/ci.yml?branch=master&style=flat-square)](https://github.com/arodoo/epubgen-vscode-jump/actions)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
[![VS Code ^1.85](https://img.shields.io/badge/vscode-%5E1.85-007ACC?style=flat-square)](https://code.visualstudio.com/)
[![Tests: 46 passing](https://img.shields.io/badge/tests-46%20passing-brightgreen?style=flat-square)](#tests)

VS Code's built-in `Alt+F5` / `Shift+Alt+F5` jumps to the **line** of the next/previous change. When the change is buried at column 300 of a long line, you spend time scrolling to find it.

This extension jumps directly to the **character position** of the change.

## At a glance

| | |
|---|---|
| **Next change** | `Alt + M` |
| **Previous change** | `Alt + N` |
| **Native `Alt+F5`** | unchanged |
| **Visual cues** | gutter arrows + overview ruler stripes |
| **Status bar** | `cambio N / M` after each jump |
| **Network** | none |
| **Telemetry** | none |

## Install

The extension is currently distributed via GitHub Releases. Not yet on the Marketplace.

```bash
git clone https://github.com/arodoo/epubgen-vscode-jump
cd epubgen-vscode-jump
npm install
npm run build
npx vsce package --allow-missing-repository
code --install-extension epubgen-vscode-jump-0.0.1.vsix
# or for VS Code Insiders:
code-insiders --install-extension epubgen-vscode-jump-0.0.1.vsix --force
```

Restart VS Code after install (`Developer: Reload Window` does not re-scan the extensions folder).

## How it works

```
            editor (working tree)
                       │
       ┌───────────────┴───────────────┐
       │                               │
   diffLines                       git show
   on normalized LF            HEAD:path  (LF)
       │                               │
       └───────────────┬───────────────┘
                       │
             diffChars per
            modified line pair
                       │
            firstOffsetPerLine
            (one nav per line)
                       │
            offset in normalized
                       │
          offsetInNormalizedToActual
            (walks CRLF/LF)
                       │
                       ▼
            vscode.Position(line, col)
                       │
              editor.selection = target
              editor.revealRange(centered)
```

### Components

| File | Role |
|---|---|
| `src/diffCore.ts` | Pure functions: `computeChangeOffsets`, `offsetInNormalizedToActual`, `findNextOffset`, `findPrevOffset`. **Zero `vscode` imports** — directly unit-testable in Node. |
| `src/diffPositions.ts` | Adapter: wraps `diffCore` for `vscode.TextDocument`; runs `git show` via `child_process.execFile`. |
| `src/extension.ts` | Registers commands, gutter + ruler decorations, status bar, debounced refresh on text changes. |
| `test/diffCore.test.ts` | 46 unit tests, run with `tsx` against the TS source — no VS Code required. |

### Algorithm in detail

1. **Read HEAD version** with `git show HEAD:path` (fallback to `:0:path` for staged but uncommitted changes).
2. **Read working version** from `editor.document.getText()`.
3. **Normalize both** to LF (`\r\n` → `\n`, `\r` → `\n`). This is **critical** when `core.autocrlf=true` produces CRLF in the working tree and LF in HEAD — without normalization, every line in the file would appear as changed.
4. **`diffLines`** finds which line groups differ.
5. **`diffChars`** on each modified line pair locates the **first differing column**.
6. **One offset per changed line** via `firstOffsetPerLine`. Multi-change lines collapse to a single nav point — pressing `Alt+M` iterates lines, not intra-line hunks.
7. **Map offset → Position**: walk both texts in parallel to translate the normalized offset into a real document position that accounts for any `\r\n` in the working tree.
8. **Reveal** at the target position, centered.

## Tests

```bash
npm test
```

Runs `tsx test/diffCore.test.ts` against the TypeScript source directly. No VS Code instance required, no mock harness. The test suite exercises:

- `computeChangeOffsets`: line-level deduplication, CRLF/LF normalization (3 dedicated cases), multi-change lines, new files, pure deletions, identical texts.
- `firstDiffColumn`: first differing column inside a modified line pair.
- `offsetToLineColumn` / `offsetInNormalizedToActual`: offset↔position translation for both LF-only and CRLF-bearing texts.
- `findNextOffset` / `findPrevOffset`: boundary behavior at first/last change and equal-cursor cases.

Expected output:

```text
=== diffCore.test.ts (line-aware navigation) ===

  ✓ world→there collapses to one nav point at offset 6
  ✓ many subs in same line = 1 offset
  ...
=== 46 passed, 0 failed ===
```

The CI workflow (`.github/workflows/ci.yml`) runs `npm install`, `npm run check-types`, `npm test`, and `npm run build` on every push and pull request against `master`, on Node 18, 20, and 22.

## Development

```bash
npm install          # install deps + types
npm test             # run the test suite
npm run check-types  # tsc --noEmit
npm run build        # produce out/extension.js (esbuild bundling)
npm run watch        # incremental rebuild during development
npm run package      # produce .vsix for distribution
```

## Roadmap

- [ ] Marketplace publish (requires real publisher ID)
- [ ] Clickable gutter arrows (currently keybinding-only; `gutterIconPath` doesn't expose click events)
- [ ] Diff hunk body preview in the status bar
- [ ] Stash-aware navigation (`git show stash@{0}:path`)
- [ ] Multi-root workspace support

## Contributing

Issues and pull requests welcome. The CI pipeline runs `npm test` against Node 18, 20, 22 on every PR.

## License

MIT — see [LICENSE](LICENSE).
