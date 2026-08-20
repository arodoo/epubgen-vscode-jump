import * as vscode from 'vscode';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as path from 'node:path';
import {
  computeChangeOffsets,
  offsetInNormalizedToActual,
} from './diffCore';

const execFileP = promisify(execFile);

export interface PositionsResult {
  positions: vscode.Position[];
  total: number;
}

interface RepoContext {
  root: string;
  relPath: string;
  oldText: string;
}

export async function getChangePositions(
  doc: vscode.TextDocument
): Promise<PositionsResult> {
  if (doc.uri.scheme !== 'file') {
    throw new Error('archivo no local');
  }
  const fsPath = doc.uri.fsPath;
  if (!fsPath) {
    throw new Error('sin ruta');
  }

  const ctx = await getRepoContext(fsPath);
  const newText = doc.getText();
  const normalized = newText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  const offsets = computeChangeOffsets(ctx.oldText, newText);
  const positions = offsets.map((o) => {
    const { line, column } = offsetInNormalizedToActual(normalized, newText, o);
    if (line >= doc.lineCount) {
      const lastLine = doc.lineCount - 1;
      const last = doc.lineAt(lastLine);
      const lastTrim = last.text.endsWith('\r')
        ? last.text.length - 1
        : last.text.length;
      return new vscode.Position(lastLine, Math.min(column, lastTrim));
    }
    const docLine = doc.lineAt(line);
    const trimmed = docLine.text.endsWith('\r')
      ? docLine.text.length - 1
      : docLine.text.length;
    const safeCol = Math.min(column, trimmed);
    return new vscode.Position(line, safeCol);
  });

  return { positions, total: positions.length };
}

async function getRepoContext(fsPath: string): Promise<RepoContext> {
  const dir = path.dirname(fsPath);
  let root: string;
  try {
    const { stdout } = await execFileP(
      'git',
      ['rev-parse', '--show-toplevel'],
      { cwd: dir }
    );
    root = stdout.trim();
  } catch {
    throw new Error('no es repo git');
  }

  const relPath = path.relative(root, fsPath).replace(/\\/g, '/');

  try {
    await execFileP('git', ['ls-files', '--error-unmatch', relPath], {
      cwd: root,
    });
  } catch {
    throw new Error('archivo no trackeado');
  }

  let oldText: string;
  try {
    const { stdout } = await execFileP(
      'git',
      ['show', `HEAD:${relPath}`],
      {
        cwd: root,
        maxBuffer: 64 * 1024 * 1024,
      }
    );
    oldText = stdout;
  } catch {
    const staged = await tryReadIndex(root, relPath);
    if (staged !== null) {
      oldText = staged;
    } else {
      oldText = '';
    }
  }

  return { root, relPath, oldText };
}

async function tryReadIndex(
  root: string,
  relPath: string
): Promise<string | null> {
  try {
    const { stdout } = await execFileP(
      'git',
      ['show', `:0:${relPath}`],
      { cwd: root, maxBuffer: 64 * 1024 * 1024 }
    );
    return stdout;
  } catch {
    return null;
  }
}

export function findNextChange(
  positions: vscode.Position[],
  cursor: vscode.Position
): vscode.Position | undefined {
  for (const p of positions) {
    if (
      p.line > cursor.line ||
      (p.line === cursor.line && p.character > cursor.character)
    ) {
      return p;
    }
  }
  return undefined;
}

export function findPrevChange(
  positions: vscode.Position[],
  cursor: vscode.Position
): vscode.Position | undefined {
  let last: vscode.Position | undefined;
  for (const p of positions) {
    if (
      p.line < cursor.line ||
      (p.line === cursor.line && p.character < cursor.character)
    ) {
      last = p;
    } else {
      break;
    }
  }
  return last;
}
