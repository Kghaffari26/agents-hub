/** Minimal unified-diff line classifier for the fix-proposal preview (unit-tested). */
export type DiffLineKind = 'file' | 'meta' | 'hunk' | 'add' | 'del' | 'ctx';

export interface DiffLine {
  kind: DiffLineKind;
  text: string;
}

export function parseDiff(diff: string): DiffLine[] {
  const lines = diff.replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n');
  return lines.map((text) => {
    if (text.startsWith('diff --git')) return { kind: 'file', text };
    if (
      /^(index |--- |\+\+\+ |new file mode|deleted file mode|similarity index|rename (from|to) )/.test(text)
    )
      return { kind: 'meta', text };
    if (text.startsWith('@@')) return { kind: 'hunk', text };
    if (text.startsWith('+')) return { kind: 'add', text };
    if (text.startsWith('-')) return { kind: 'del', text };
    return { kind: 'ctx', text };
  });
}

/** Additions/deletions per file, for proposals that don't publish `files`. */
export function diffFiles(lines: DiffLine[]): { path: string; additions: number; deletions: number }[] {
  const out: { path: string; additions: number; deletions: number }[] = [];
  for (const l of lines) {
    if (l.kind === 'file')
      out.push({ path: l.text.split(' b/').slice(1).join(' b/') || l.text, additions: 0, deletions: 0 });
    else if (out.length && l.kind === 'add') out[out.length - 1].additions++;
    else if (out.length && l.kind === 'del') out[out.length - 1].deletions++;
  }
  return out;
}
