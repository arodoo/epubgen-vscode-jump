# Jump to Exact Change

Extensión para VS Code que añade dos comandos para saltar al **carácter exacto** del siguiente o anterior cambio git. Todo local, sin red, sin telemetría.

## Atajos

| Acción | Atajo |
|---|---|
| Siguiente cambio (exacto) | `Alt + M` |
| Cambio anterior (exacto) | `Alt + N` |

Las flechas nativas (`Alt + F5` / `Shift + Alt + F5`) siguen funcionando intactas — esta extensión **no las modifica**.

## Comportamiento

1. Compara el buffer actual contra la versión `HEAD` del archivo (o el índice si hay staged sin commit).
2. Si no está trackeado o no es repo git → no-op con aviso en status bar.
3. Calcula los cambios a nivel de carácter (`diffChars`) dentro de cada par de líneas modificadas (`diffLines`).
4. **Normaliza CR/CRLF/LF** antes del diff — evita falsos positivos cuando `core.autocrlf=true` genera CRLF en el working tree y LF en HEAD.
5. **Deduplica por línea**: una línea con N cambios tiene UN punto de navegación en su primera columna cambiada. Evita que `Alt+M` salte entre los cambios dentro de la misma línea antes de pasar a la siguiente.
6. **Mapeo de offsets normalizados a posiciones reales**: el cursor cae en la columna exacta del cambio, no en el final de la línea.
7. Cursor salta al carácter exacto del primer cambio de la línea siguiente/anterior.
8. La status bar muestra `cambio N / M` durante 2.5s.

## Iconos en gutter

- **Gutter izquierdo**: flechas `↓` (siguiente) y `↑` (anterior) en cada posición donde hay un cambio. La primera posición muestra solo `↓`, la última solo `↑`, las intermedias ambas. Visualmente son los mismos path SVG que los codicons nativos de VS Code (`arrow-down` / `arrow-up`), empaquetados como data URIs dentro del bundle.
- **Overview ruler derecho**: franjas verdes (`editorOverviewRuler.modifiedForeground`) en cada cambio.
- Visibilidad: cuando el editor activo tiene cambios (`editorHasChanges`).
- No son clickeables (la API pública de `gutterIconPath` no expone eventos de click); se usan vía los atajos.

## Build local

```bash
npm install
npm test       # corre los 46 tests (sin VS Code, sólo Node)
npm run build  # produce out/extension.js (incluye `diff` bundleado)
```

Resultado: `out/extension.js` (~26 KB) con `diff` bundleado internamente. No se copia `node_modules/` a la instalación.

## Instalación local en VS Code

```bash
npx vsce package --allow-missing-repository
code --install-extension epubgen-vscode-jump-0.0.1.vsix
# o en Insiders:
code-insiders --install-extension epubgen-vscode-jump-0.0.1.vsix --force
```

Luego cerrar y reabrir VS Code (botón × de la ventana; `Reload Window` no rescanea extensiones).

## Tests

```bash
npm test
```

46 tests en `test/diffCore.test.ts`, ejecutados con `tsx` sobre el código fuente TS:

- `computeChangeOffsets`: deduplicación por línea, normalización CRLF/LF, multi-cambio en misma línea, archivos nuevos, eliminaciones puras.
- `firstDiffColumn`: dentro de cada par de líneas modificadas, encuentra la primera columna que difiere a nivel de carácter.
- `offsetToLineColumn`: mapear offsets a posiciones (línea, col).
- `offsetInNormalizedToActual`: convertir offsets del texto normalizado (LF) a posiciones del documento real (con CRLF).
- `findNextOffset` / `findPrevOffset`: navegación con cursor en el medio y en bordes.

## Privacidad

- No hace llamadas de red.
- Invoca `git` localmente vía `child_process.execFile`.
- Sin telemetría.
