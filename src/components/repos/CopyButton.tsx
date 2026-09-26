'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/** Copy-to-clipboard button with "Copied" feedback announced through aria-live. */
export function CopyButton({
  text,
  label = 'Copy',
  srContext,
}: {
  text: string;
  label?: string;
  /** Extra screen-reader context, e.g. "nudge for PR #12". */
  srContext?: string;
}) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  async function onClick() {
    const ok = await copyText(text);
    setState(ok ? 'copied' : 'failed');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState('idle'), 2000);
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" className="btn" onClick={onClick}>
        {state === 'copied' ? (
          <Check className="h-4 w-4" aria-hidden />
        ) : (
          <Copy className="h-4 w-4" aria-hidden />
        )}
        {label}
        {srContext && <span className="sr-only"> {srContext}</span>}
      </button>
      <span aria-live="polite" role="status" className="text-xs text-muted">
        {state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed; select the text instead' : ''}
      </span>
    </span>
  );
}
