import { Methodology } from '@/components/common/Methodology';
import type { MacroLatest } from '@/lib/schemas/macro';

/** Methodology, rules and the raw events list (SPEC_MACRO §5, §6 rules). */
export function MacroMethodology({ events }: { events: MacroLatest['events'] }) {
  return (
    <Methodology>
      <h3>Transforms</h3>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          <strong>YoY</strong>: (x<sub>t</sub> / x<sub>t−12</sub> − 1) × 100 for monthly series (t−4 for
          quarterly; the nearest observation 52 weeks earlier for weekly).
        </li>
        <li>
          <strong>MoM</strong>: (x<sub>t</sub> / x<sub>t−1</sub> − 1) × 100. Payroll changes are the
          difference in thousands.
        </li>
        <li>
          <strong>3-mo annualized</strong>: ((x<sub>t</sub> / x<sub>t−3</sub>)<sup>4</sup> − 1) × 100, a read
          on inflation momentum.
        </li>
        <li>
          Changes in rates and percentages are shown in <strong>percentage points (pp)</strong>, never as a
          percent change.
        </li>
        <li>
          Sparklines show the last 24 observations (daily and weekly series are resampled). Expanded charts
          show up to 10 years; daily series are resampled to weekly (Friday close).
        </li>
      </ul>

      <h3>Revisions and delays</h3>
      <p>
        A value counts as revised when it moves by more than 0.05 (percent series) or 1 (thousands-level
        counts) versus the previously stored reading. Only revisions within the last three periods are shown.
        An indicator is marked <strong>Release delayed</strong> when its scheduled release date passed more
        than two days ago with no new observation.
      </p>

      <h3>Regime rules</h3>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          <strong>Inflation</strong> (core PCE): Cooling when the 3-mo annualized rate is more than 0.3 pp
          below YoY, Heating when more than 0.3 pp above, otherwise Steady.
        </li>
        <li>
          <strong>Labor</strong> (Sahm-style): the 3-month average unemployment rate minus its low over the
          prior 12 months. At ≥ 0.50 pp, Sahm rule triggered; at ≥ 0.30 pp or a payrolls 3-month average below
          50K, Softening; otherwise Stable.
        </li>
        <li>
          <strong>Growth</strong> (real GDP, annualized): below 0 Contracting, 0–1.5 Slow, 1.5–3 Moderate,
          above 3 Strong.
        </li>
        <li>
          <strong>Policy</strong>: the latest FOMC decision (Cutting / Holding / Hiking) with the target
          range.
        </li>
        <li>
          <strong>Curve</strong> (10Y–2Y): below 0 Inverted, 0–0.5 Flat, above 0.5 Normal.
        </li>
      </ul>

      <h3>Colors and caveats</h3>
      <p>
        Change colors are semantic, not sign-based, and every change also carries ▲/▼ and a sign. For
        inflation, “good” is simplified to <em>down</em>, although the Fed’s goal is 2%, not as low as
        possible. Rates and yields are colored as neutral. University of Michigan sentiment reaches FRED with
        a lag of about a month, so the latest FRED value can trail the preliminary survey headline.
      </p>
      <p>
        The “What changed” brief and the plain-English Fed read are written by an AI model from the detected
        events and are number-checked against the data; the statement diff itself is computed word by word in
        your browser. Not investment advice.
      </p>

      <h3>Events</h3>
      <p>
        This run detected {events.length} {events.length === 1 ? 'event' : 'events'}, ranked by priority; the
        top events feed the brief.
      </p>
      {events.length > 0 && (
        <details className="rounded-card border border-border p-3">
          <summary className="cursor-pointer font-medium text-text">Show raw events</summary>
          <div className="table-wrap mt-2">
            <table className="data-table num">
              <caption className="sr-only">Raw events detected in this run</caption>
              <thead>
                <tr>
                  <th scope="col">Priority</th>
                  <th scope="col">Type</th>
                  <th scope="col">ID</th>
                  <th scope="col">Facts</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id}>
                    <td>{e.priority}</td>
                    <td>{e.type}</td>
                    <td className="break-all font-mono text-xs">{e.id}</td>
                    <td className="font-mono text-xs">{JSON.stringify(e.facts)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </Methodology>
  );
}
