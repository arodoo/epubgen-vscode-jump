import { diffChars, diffLines, Change } from 'diff';

export interface OffsetPosition {
  offset: number;
  line: number;
  column: number;
}

export function computeChangeOffsets(
  oldText: string,
  newText: string
): number[] {
  const oldNorm = normalizeToLF(oldText);
  const newNorm = normalizeToLF(newText);
  const offsets: number[] = [];
  collectOffsetsIn(oldNorm, newNorm, offsets);
  return offsets;
}

function collectOffsetsIn(
  oldText: string,
  newText: string,
  out: number[]
): void {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const colByNewLine = changedColumnsByNewLine(oldText, newText, oldLines, newLines);

  let offset = 0;
  for (let lineIdx = 0; lineIdx < newLines.length; lineIdx++) {
    if (colByNewLine.has(lineIdx)) {
      out.push(offset + colByNewLine.get(lineIdx)!);
    }
    offset += newLines[lineIdx].length + 1;
  }
}

function normalizeToLF(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function changedColumnsByNewLine(
  oldText: string,
  newText: string,
  oldLines: string[],
  newLines: string[]
): Map<number, number> {
  const result = new Map<number, number>();
  const lineParts = diffLines(oldText, newText);

  let oldIdx = 0;
  let newIdx = 0;

  for (let i = 0; i < lineParts.length; i++) {
    const p = lineParts[i] as Change & { value: string };
    const lines = splitLines(p.value);

    if (p.removed && lineParts[i + 1] && (lineParts[i + 1] as Change).added) {
      const next = lineParts[i + 1] as Change & { value: string };
      const addedLines = splitLines(next.value);
      const pairs = Math.min(lines.length, addedLines.length);

      for (let k = 0; k < pairs; k++) {
        if (oldIdx + k >= oldLines.length || newIdx + k >= newLines.length) break;
        const col = firstDiffColumn(oldLines[oldIdx + k], newLines[newIdx + k]);
        if (col !== null) {
          result.set(newIdx + k, col);
        }
      }
      for (let k = pairs; k < addedLines.length; k++) {
        const target = newIdx + k;
        if (target < newLines.length) {
          result.set(target, 0);
        }
      }

      oldIdx += lines.length;
      newIdx += addedLines.length;
      i++;
      continue;
    }

    if (p.removed) {
      oldIdx += lines.length;
      continue;
    }

    if (p.added) {
      for (let k = 0; k < lines.length; k++) {
        const target = newIdx + k;
        if (target < newLines.length) {
          result.set(target, 0);
        }
      }
      newIdx += lines.length;
      continue;
    }

    oldIdx += lines.length;
    newIdx += lines.length;
  }

  return result;
}

function splitLines(value: string): string[] {
  const parts = value.split('\n');
  if (parts.length > 0 && parts[parts.length - 1] === '') {
    parts.pop();
  }
  return parts;
}

function firstDiffColumn(oldLine: string, newLine: string): number | null {
  if (oldLine === newLine) return null;
  const parts = diffChars(oldLine, newLine);
  let col = 0;
  for (const part of parts) {
    if (part.added || part.removed) {
      return col;
    }
    col += part.value.length;
  }
  return col;
}

export function offsetInNormalizedToActual(
  normalized: string,
  actual: string,
  normOff: number
): { line: number; column: number } {
  let n = 0;
  let a = 0;
  let line = 0;
  let col = 0;
  while (n < normOff && a < actual.length) {
    if (actual[a] === '\r' && actual[a + 1] === '\n') {
      a += 2;
      n++;
      line++;
      col = 0;
      continue;
    }
    if (actual[a] === '\n') {
      a++;
      n++;
      line++;
      col = 0;
      continue;
    }
    a++;
    n++;
    col++;
  }
  if (n < normOff) {
    while (n < normOff && normalized[n] === '\n') {
      n++;
      line++;
      col = 0;
    }
    while (n < normOff) {
      n++;
      col++;
    }
  }
  return { line, column: col };
}

export function offsetToLineColumn(
  text: string,
  offset: number
): { line: number; column: number } {
  const o = Math.min(Math.max(offset, 0), text.length);
  let line = 0;
  let lastNewline = -1;
  for (let i = 0; i < o; i++) {
    if (text[i] === '\n') {
      line++;
      lastNewline = i;
    }
  }
  return { line, column: o - (lastNewline + 1) };
}

export function offsetsToPositions(
  text: string,
  offsets: number[]
): OffsetPosition[] {
  const result: OffsetPosition[] = [];
  for (const o of offsets) {
    const { line, column } = offsetToLineColumn(text, o);
    result.push({ offset: o, line, column });
  }
  return result;
}

export function findNextOffset(
  offsets: number[],
  cursorOffset: number
): number | null {
  for (const o of offsets) {
    if (o > cursorOffset) {
      return o;
    }
  }
  return null;
}

export function findPrevOffset(
  offsets: number[],
  cursorOffset: number
): number | null {
  let last: number | null = null;
  for (const o of offsets) {
    if (o < cursorOffset) {
      last = o;
    } else {
      break;
    }
  }
  return last;
}
