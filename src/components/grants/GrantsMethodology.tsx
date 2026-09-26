import { ExternalLink } from 'lucide-react';
import type { GrantsLatest } from '@/lib/schemas/grants';
import { count } from '@/lib/format';
import { Methodology, SectionHeading } from '@/components/common/Methodology';
import { SUB_SCORE_MAX } from './FitMeter';
import { PROFILE_TOML_URL, profileSummary } from './ProfileChip';
import { SOURCE_LABEL } from './grantsFilters';

const REJECT_LABEL: Record<string, string> = {
  deadline: 'Deadline past or too soon to respond',
  type: 'Notice type not wanted',
  agency_excluded: 'Excluded agency',
  set_aside: 'Set-aside needs a certification the profile lacks',
  eligibility: 'Grant eligibility excludes the entity type',
  value: 'Known value outside the profile range',
  place: 'Place of performance outside allowed states',
  negative_keyword: 'Negative keyword in the title',
};

const RUBRIC_MEANING: Record<string, string> = {
  capability: 'How well the requested work matches the profile summary, keywords and past performance',
  eligibility:
    'Set-aside, entity type, clearance and registration fit, using eligibility facts computed in code',
  size: 'Value and scope vs team capacity and the value range (unknown value scores a neutral 8)',
  timeline: 'Days to deadline vs the effort for this notice type',
  strategic: 'Target agency, likely follow-on work, overlap with the profile direction',
};

/** Visible explanation of the matching profile (anchor target of the profile chip). */
export function ProfileSection({ profile }: { profile: GrantsLatest['profile'] }) {
  return (
    <section id="profile" aria-labelledby="profile-title" className="scroll-mt-20">
      <SectionHeading id="profile-title">Matching profile</SectionHeading>
      <div className="card space-y-3 p-4 text-sm leading-relaxed md:p-5">
        <p>
          Every opportunity is screened and scored against one business profile:{' '}
          <strong className="font-semibold">{profileSummary(profile)}</strong>.
        </p>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-muted">Primary NAICS</dt>
            <dd className="num">{profile.naics.length ? profile.naics.join(', ') : '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Eligible set-asides</dt>
            <dd>{profile.set_asides_eligible.length ? profile.set_asides_eligible.join('; ') : '—'}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs text-muted">Keywords (preview)</dt>
            <dd>
              {profile.keywords_preview.length ? (
                <ul className="mt-1 flex flex-wrap gap-1.5">
                  {profile.keywords_preview.map((k) => (
                    <li key={k} className="chip">
                      {k}
                    </li>
                  ))}
                </ul>
              ) : (
                '—'
              )}
            </dd>
          </div>
        </dl>
        <p>
          <strong className="font-semibold">To change the profile</strong>, edit{' '}
          <a href={PROFILE_TOML_URL} className="link inline-flex items-center gap-1">
            <code>config/business_profile.toml</code>
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>{' '}
          in the sam-agent repository (name, summary, NAICS codes, PSC prefixes, keywords, negative keywords,
          certifications, value range, clearance, target agencies and notice types), then let the next
          scheduled run pick it up. The profile hash is part of every score cache key, so editing the profile
          re-scores everything on the next run.
        </p>
        <p className="text-xs text-muted">
          Profile id <code>{profile.id}</code> · hash{' '}
          <code className="break-all">{profile.profile_hash.slice(0, 12)}</code>
        </p>
      </div>
    </section>
  );
}

export function GrantsMethodology({ data }: { data: GrantsLatest }) {
  const { thresholds, stats } = data;
  const fetchedTotal = Object.values(stats.fetched).reduce((a, b) => a + b, 0);
  const rejectedTotal = Object.values(stats.rejected).reduce((a, b) => a + b, 0);
  return (
    <Methodology title="How matching and scoring work">
      <h3>1. Fetch</h3>
      <p>
        This run fetched <span className="num">{count(fetchedTotal)}</span> opportunities (
        {Object.entries(stats.fetched)
          .map(([k, v]) => `${SOURCE_LABEL[k as keyof typeof SOURCE_LABEL] ?? k}: ${count(v)}`)
          .join(', ')}
        ). Duplicates and amendments are collapsed to the newest notice.
        {data.meta.sam_requests_used != null && (
          <>
            {' '}
            SAM.gov requests used: <span className="num">{data.meta.sam_requests_used}</span>.
          </>
        )}
      </p>

      <h3>2. Hard filters</h3>
      <p>
        Deterministic rules reject items the profile can&apos;t bid on.{' '}
        <span className="num">{count(rejectedTotal)}</span> were rejected this run:
      </p>
      <ul className="list-disc space-y-0.5 pl-5">
        {Object.entries(stats.rejected).map(([k, v]) => (
          <li key={k}>
            {REJECT_LABEL[k] ?? k}: <span className="num">{count(v)}</span>
          </li>
        ))}
      </ul>

      <h3>3. Relevance pre-score (0–100, no AI)</h3>
      <p>
        Points for NAICS matches (primary +50, secondary +35, shared 4-digit prefix +20), PSC prefix (+15),
        profile keywords in the title (up to +30) and description (up to +20), and a target agency (+5);
        negative keywords in the description subtract 30. Items scoring at least{' '}
        <span className="num">{thresholds.relevance}</span> go to the model;{' '}
        <span className="num">{count(stats.below_relevance)}</span> fell below it and appear in the table
        without a fit score.
      </p>

      <h3>4. Rubric fit score (0–100)</h3>
      <p>
        A fast model scores each candidate on five sub-scores; code clamps each to its range and sums them.
        This run scored <span className="num">{count(stats.llm_scored_this_run)}</span> items and reused{' '}
        <span className="num">{count(stats.llm_scored_cached)}</span> cached scores.
      </p>
      <ul className="list-disc space-y-0.5 pl-5">
        {SUB_SCORE_MAX.map((s) => (
          <li key={s.key}>
            <strong>{s.label}</strong> (0–{s.max}): {RUBRIC_MEANING[s.key]}
          </li>
        ))}
      </ul>
      <p>
        <strong>Caps:</strong> a red flag showing a hard incompatibility (a clearance above the
        profile&apos;s, or &quot;8(a) only&quot;) caps fit at 20; a low-confidence score without the full
        description is capped at 70.
      </p>
      <p>
        <strong>Recommendation:</strong> fit ≥ {thresholds.pursue} is <strong>Pursue</strong>,{' '}
        {thresholds.consider}–{thresholds.pursue - 1} is <strong>Consider</strong>, and below{' '}
        {thresholds.consider} is <strong>Pass</strong>.
      </p>

      <h3>5. Summaries</h3>
      <p>
        The top 20 get a short AI summary (what they want, why it fits, risks, next steps). When the AI output
        fails validation, a deterministic template is used instead and labelled &quot;Template summary&quot;.
      </p>

      <h3>Limitations</h3>
      <ul className="list-disc space-y-0.5 pl-5">
        <li>Many SAM.gov notices don&apos;t disclose a value; those show &quot;Not disclosed&quot;.</li>
        <li>
          Descriptions and attachments may not be read for every item, and the SAM.gov API has a daily request
          budget.
        </li>
        <li>Scores are a screening aid, not a bid/no-bid decision, and AI summaries can contain errors.</li>
        <li>Days left are computed in your browser from the listed deadline.</li>
      </ul>
      <p>
        <strong>Always verify on the official listing before acting.</strong> {data.disclaimer}
      </p>
    </Methodology>
  );
}
