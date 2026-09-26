import { UserRound } from 'lucide-react';
import type { GrantsLatest } from '@/lib/schemas/grants';

export const PROFILE_TOML_URL =
  'https://github.com/Kghaffari26/sam-agent/blob/main/config/business_profile.toml';

/** "Small business" when the profile is eligible for small-business set-asides. */
export function profileEligibility(profile: GrantsLatest['profile']): string | null {
  const s = profile.set_asides_eligible.join(' ').toLowerCase();
  if (/small business|\bsba\b|\bsbp\b/.test(s)) return 'Small business';
  return profile.set_asides_eligible[0] ?? null;
}

export function profileSummary(profile: GrantsLatest['profile']): string {
  const parts = [profile.name];
  if (profile.naics.length) parts.push(`NAICS ${profile.naics.join(', ')}`);
  const elig = profileEligibility(profile);
  if (elig) parts.push(elig);
  return parts.join(' · ');
}

/** Profile summary chip; links to the in-page explanation of how to change the profile. */
export function ProfileChip({ profile }: { profile: GrantsLatest['profile'] }) {
  return (
    <a
      href="#profile"
      className="chip max-w-full py-1 text-sm font-normal text-text hover:border-accent"
      title="How matching works and how to change the business profile"
    >
      <UserRound className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
      <span className="min-w-0">
        <span className="text-muted">Matching for:</span>{' '}
        <span className="font-medium">{profileSummary(profile)}</span>
        <span className="sr-only"> (how to change the profile)</span>
      </span>
    </a>
  );
}
