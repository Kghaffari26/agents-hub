import { CheckCircle2, Clock, MinusCircle, XCircle } from 'lucide-react';
import { CI_LABEL, type CiState } from './labels';

const STYLE: Record<CiState, { Icon: typeof CheckCircle2; cls: string }> = {
  success: { Icon: CheckCircle2, cls: 'text-good' },
  failure: { Icon: XCircle, cls: 'text-bad' },
  pending: { Icon: Clock, cls: 'text-neutral' },
  none: { Icon: MinusCircle, cls: 'text-muted' },
};

/** CI state with icon + text (never color alone). */
export function CiStatus({ state }: { state: CiState }) {
  const { Icon, cls } = STYLE[state];
  return (
    <span className={`inline-flex items-center gap-1 font-medium ${cls}`} data-ci={state}>
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      {CI_LABEL[state]}
    </span>
  );
}
