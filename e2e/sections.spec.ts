import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { data } from './helpers';

test('macro: indicators, revision badge, yield curve, FOMC diff', async ({ page }) => {
  await page.goto('macro/');
  await expect(page.getByTestId('regime-strip')).toBeVisible();
  await expect(page.locator('[data-testid^="indicator-card-"]').first()).toBeVisible();
  // Revisions only exist on some days (fixtures have them; a live run may not).
  const revised = data<{ indicators: { revision: unknown }[] }>('macro/latest.json').indicators.filter(
    (i) => i.revision,
  ).length;
  if (revised) await expect(page.getByTestId('revision-badge').first()).toBeVisible();
  else await expect(page.getByTestId('revision-badge')).toHaveCount(0);
  await page.getByRole('status').filter({ hasText: 'Loading yield curve' }).scrollIntoViewIfNeeded();
  await expect(page.getByTestId('yield-curve')).toBeVisible();
  const diff = page.getByTestId('statement-diff');
  await expect(diff.locator('ins').first()).toBeVisible();
  await expect(diff.locator('del').first()).toBeVisible();
});

test('grants: closing ≤14d + min fit 70, sort by deadline, export CSV matches visible rows', async ({
  page,
}) => {
  await page.goto('grants/');
  await expect(page.getByTestId('match-card').first()).toBeVisible();
  const load = page.getByRole('button', { name: /Load all/ });
  // all.json loads when the section scrolls into view, or via the button — either is fine.
  await load.click({ timeout: 3000 }).catch(() => {});
  const table = page.getByTestId('grants-table');
  await expect(table).toBeVisible();
  await page.getByTestId('grants-filter-closing').selectOption('14');
  await page.getByTestId('grants-filter-minfit').fill('70');
  await table.getByRole('button', { name: /Deadline/ }).click();
  const rows = page.getByTestId('grants-row');
  const n = await rows.count();
  const visibleTitles = await rows.evaluateAll((trs) =>
    trs.map((tr) => tr.querySelectorAll('td')[2]?.textContent?.trim() ?? ''),
  );
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('grants-export').click(),
  ]);
  const csv = readFileSync(await download.path(), 'utf8');
  const lines = csv.trim().split('\r\n');
  expect(lines.length - 1).toBe(n); // ≤ 25, so every filtered row is on this page
  for (const t of visibleTitles.filter(Boolean)) expect(csv).toContain(t.replace(/"/g, '""').slice(0, 20));
});

test('repos: triage, stale PRs, changelog, actions, mode badge', async ({ page }) => {
  const d = JSON.parse(readFileSync('out/data/repo_maint/latest.json', 'utf8'));
  await page.goto('repos/');
  await expect(page.getByTestId('mode-badge')).toContainText(
    d.mode === 'apply' ? 'Apply mode' : 'Report mode',
  );
  await expect(page.getByTestId('triage-table')).toBeVisible();
  await expect(page.getByTestId('stale-prs')).toBeVisible();
  await expect(page.getByTestId('changelog-draft').first()).toBeVisible();
  await expect(page.getByTestId('actions-log')).toBeVisible();
});
