import { CopyButton } from '../repos/CopyButton';

/** Install snippet with a copy button; the <pre> is focusable so it can be scrolled by keyboard. */
export function CodeBlock({ code, label }: { code: string; label: string }) {
  return (
    <div className="overflow-hidden rounded-md border border-border">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-surface-2 px-3 py-1.5">
        <span className="text-xs font-medium text-muted">{label}</span>
        <CopyButton text={code} srContext={label} />
      </div>
      <pre
        className="overflow-x-auto bg-surface p-3 font-mono text-[13px] leading-5"
        tabIndex={0}
        aria-label={label}
      >
        <code>{code}</code>
      </pre>
    </div>
  );
}
