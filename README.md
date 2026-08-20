# Jump to Exact Change

Extensión para VS Code que añade dos comandos para saltar al **carácter exacto** del siguiente o anterior cambio git. Token-level (palabra por palabra), sin server-side.

## Atajos

| Acción | Atajo |
|---|---|
| Siguiente cambio (exacto) | `Alt + N` |
| Cambio anterior (exacto) | `Alt + M` |

Las flechas nativas (`Alt + F5` / `Shift + Alt + F5`) siguen saltando a la línea; esta extensión **no las modifica**.

## Comportamiento

1. Compara el buffer actual contra la versión `HEAD` del archivo.
2. Si el archivo está staged pero sin commit, cae al índice (`:0:path`).
3. Si no está trackeado → no-op con aviso en status bar.
4. Calcula los cambios a nivel de palabra con `diffWordsWithSpace` y los mapea a `Position` reales del editor.
5. Cursor salta al carácter exacto del inicio del siguiente/anterior token modificado.
6. La status bar muestra `cambio N / M` durante 2.5s.

## Iconos en gutter

- **Gutter izquierdo**: flechas `↓` (siguiente) y `↑` (anterior) en cada posición donde hay un cambio. La primera posición muestra solo `↓`, la última solo `↑`, las intermedias ambas. Visualmente son los mismos path SVG que los codicons nativos de VS Code (`arrow-down` / `arrow-up`).
- **Overview ruler derecho**: franjas verdes (`editorOverviewRuler.modifiedForeground`) en cada cambio, igual que las que VS Code ya dibuja pero asociadas a cambios exactos.
- **Visibilidad**: aparecen cuando el editor activo tiene cambios (`editorHasChanges`) — mismo trigger que las flechas nativas.
- **No son clickeables** (la API pública de `gutterIconPath` no expone eventos de click); se usan vía `Alt + N` / `Alt + M`.

## Privacidad

- No hace llamadas de red.
- Invoca `git` localmente vía `child_process.execFile`.
- Sin telemetría.

## Estructura

```
epubgen-vscode-jump/
├── package.json
├── tsconfig.json
├── esbuild.config.js       # bundler: produce out/extension.js con todo bundleado
├── .vscodeignore
├── src/
│   ├── extension.ts        # registra comandos + UI status bar
│   └── diffPositions.ts    # git show HEAD + jsdiff → posiciones
└── out/
    └── extension.js        # (generado)
```

## Build local

```powershell
npm install
npm run build
```

Resultado: `out/extension.js` con `diff` bundleado internamente (no se copia `node_modules/` al directorio de extensiones).

## Instalación local en VS Code Insiders

```powershell
$extName = "local.epubgen-vscode-jump-0.0.1"
$extDir  = "$env:USERPROFILE\.vscode-insiders\extensions\$extName"
New-Item -ItemType Directory -Force -Path $extDir
Copy-Item -Path out,package.json -Destination $extDir -Recurse -Force
```

Luego `Ctrl + Shift + P` → `Developer: Reload Window`.

## Watch

```powershell
npm run watch
```

Rebuild incremental al guardar `src/*.ts`.
