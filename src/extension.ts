import * as vscode from 'vscode';
import {
  getChangePositions,
  findNextChange,
  findPrevChange,
} from './diffPositions';

const NEXT_ARROW_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">' +
  '<path d="M4.427 9.573l3.396-3.396a.25.25 0 0 1 .354 0l3.396 3.396a.25.25 0 0 1-.177.427H4.604a.25.25 0 0 1-.177-.427z"/>' +
  '</svg>';

const PREV_ARROW_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">' +
  '<path d="M11.573 6.427L8.177 9.823a.25.25 0 0 1-.354 0L4.427 6.427A.25.25 0 0 1 4.604 6h6.792a.25.25 0 0 1 .177.427z"/>' +
  '</svg>';

const NEXT_ARROW_URI = vscode.Uri.parse(
  'data:image/svg+xml;base64,' +
    Buffer.from(NEXT_ARROW_SVG, 'utf8').toString('base64')
);
const PREV_ARROW_URI = vscode.Uri.parse(
  'data:image/svg+xml;base64,' +
    Buffer.from(PREV_ARROW_SVG, 'utf8').toString('base64')
);

let statusBar: vscode.StatusBarItem | undefined;
let log: vscode.OutputChannel | undefined;
let nextIconType: vscode.TextEditorDecorationType | undefined;
let prevIconType: vscode.TextEditorDecorationType | undefined;
let changeStripeType: vscode.TextEditorDecorationType | undefined;
const cachedPositions = new Map<string, vscode.Position[]>();
let refreshTimer: NodeJS.Timeout | undefined;

export function activate(context: vscode.ExtensionContext): void {
  log = vscode.window.createOutputChannel('epubgen-jump');
  log.appendLine('[activate] start');

  statusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    50
  );

  nextIconType = vscode.window.createTextEditorDecorationType({
    gutterIconPath: NEXT_ARROW_URI,
    gutterIconSize: 'contain',
  });

  prevIconType = vscode.window.createTextEditorDecorationType({
    gutterIconPath: PREV_ARROW_URI,
    gutterIconSize: 'contain',
  });

  changeStripeType = vscode.window.createTextEditorDecorationType({
    overviewRulerColor: new vscode.ThemeColor(
      'editorOverviewRuler.modifiedForeground'
    ),
    overviewRulerLane: vscode.OverviewRulerLane.Right,
  });

  context.subscriptions.push(
    log,
    statusBar,
    nextIconType,
    prevIconType,
    changeStripeType
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'epubgen.jumpToNextExactChange',
      () => jump('next')
    ),
    vscode.commands.registerCommand(
      'epubgen.jumpToPreviousExactChange',
      () => jump('prev')
    )
  );

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        void refreshDecorations(editor, true);
      }
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.contentChanges.length === 0) return;
      const editor = vscode.window.visibleTextEditors.find(
        (ed) => ed.document.uri.toString() === e.document.uri.toString()
      );
      if (editor) {
        scheduleRefresh(editor);
      }
    })
  );

  const active = vscode.window.activeTextEditor;
  log.appendLine(`[activate] active editor: ${active ? active.document.uri.fsPath : 'none'}`);
  if (active) {
    void refreshDecorations(active, true);
  }
  log.appendLine('[activate] done');
}

export function deactivate(): void {
  log?.appendLine('[deactivate]');
  clearTimeout(refreshTimer);
  statusBar?.dispose();
  nextIconType?.dispose();
  prevIconType?.dispose();
  changeStripeType?.dispose();
  statusBar = undefined;
  nextIconType = undefined;
  prevIconType = undefined;
  changeStripeType = undefined;
}

type Direction = 'next' | 'prev';

async function jump(direction: Direction): Promise<void> {
  const editor =
    vscode.window.activeTextEditor ?? vscode.window.visibleTextEditors[0];
  if (!editor) {
    log?.appendLine('[jump] no editor available');
    showStatus('$(zap) no hay editor');
    return;
  }

  let positions: vscode.Position[];
  try {
    const result = await getChangePositions(editor.document);
    positions = result.positions;
    cachedPositions.set(editor.document.uri.toString(), positions);
    log?.appendLine(`[jump] ${editor.document.uri.fsPath}: ${positions.length} changes`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log?.appendLine(`[jump] ERROR: ${msg}`);
    showStatus(`$(zap) ${msg}`);
    return;
  }

  if (positions.length === 0) {
    showStatus('$(check) sin cambios');
    return;
  }

  const cursor = editor.selection.active;
  const target =
    direction === 'next'
      ? findNextChange(positions, cursor)
      : findPrevChange(positions, cursor);

  if (!target) {
    showStatus(
      direction === 'next'
        ? '$(arrow-down) ya en el último cambio'
        : '$(arrow-up) ya en el primer cambio'
    );
    return;
  }

  const idx = positions.findIndex(
    (p) => p.line === target.line && p.character === target.character
  );

  if (vscode.window.activeTextEditor !== editor) {
    await vscode.window.showTextDocument(editor.document, {
      preserveFocus: false,
      viewColumn: editor.viewColumn,
    });
  }

  const newSel = new vscode.Selection(target, target);
  editor.selection = newSel;
  editor.revealRange(
    new vscode.Range(target, target),
    vscode.TextEditorRevealType.InCenterIfOutsideViewport
  );

  showStatus(`$(zap) cambio ${idx + 1} / ${positions.length}`);
  log?.appendLine(`[jump] cursor → line ${target.line + 1} col ${target.character + 1}`);
}

function scheduleRefresh(editor: vscode.TextEditor): void {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    void refreshDecorations(editor, true);
  }, 500);
}

async function refreshDecorations(
  editor: vscode.TextEditor,
  apply: boolean
): Promise<void> {
  const doc = editor.document;
  if (doc.uri.scheme !== 'file') {
    return;
  }

  let positions: vscode.Position[];
  try {
    const result = await getChangePositions(doc);
    positions = result.positions;
  } catch {
    positions = [];
  }

  cachedPositions.set(doc.uri.toString(), positions);

  if (!apply) {
    return;
  }
  if (!nextIconType || !prevIconType || !changeStripeType) {
    return;
  }

  if (positions.length === 0) {
    editor.setDecorations(changeStripeType, []);
    editor.setDecorations(nextIconType, []);
    editor.setDecorations(prevIconType, []);
    log?.appendLine(`[deco] ${doc.uri.fsPath}: no changes`);
    return;
  }

  const allRanges = positions.map((p) => new vscode.Range(p, p));
  const nextRanges = positions
    .slice(0, -1)
    .map((p) => new vscode.Range(p, p));
  const prevRanges = positions
    .slice(1)
    .map((p) => new vscode.Range(p, p));

  editor.setDecorations(changeStripeType, allRanges);
  editor.setDecorations(nextIconType, nextRanges);
  editor.setDecorations(prevIconType, prevRanges);
  log?.appendLine(
    `[deco] ${doc.uri.fsPath}: ${positions.length} changes (e.g., line ${positions[0].line + 1} col ${positions[0].character + 1})`
  );
}

function showStatus(text: string): void {
  if (!statusBar) {
    return;
  }
  statusBar.text = text;
  statusBar.show();
  setTimeout(() => {
    statusBar?.hide();
  }, 2500);
}
