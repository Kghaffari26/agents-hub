import { expect, test } from '@playwright/test';
import { data, ROUTES, trackErrors } from './helpers';

for (const route of ROUTES) {
  test(`/${route} renders with no console errors`, async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto(route);
    await expect(page.locator('h1').first()).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Main' }).first()).toBeAttached();
    await page.waitForLoadState('networkidle');
    expect(errors).toEqual([]);
  });
}

test('overview shows 4 agent cards with statuses and relative times', async ({ page }) => {
  await page.goto('');
  for (const id of ['real_estate', 'macro', 'grants', 'repo_maint']) {
    const card = page.getByTestId(`agent-card-${id}`);
    await expect(card).toBeVisible();
    await expect(card.locator('[data-status]')).toHaveCount(1);
    await expect(card.getByTestId('last-updated')).toContainText(/Updated|Checked/);
  }
  await expect(page.getByText(/This month/)).toBeVisible();
});

test('a stale agent flips to "Stale" when time moves on', async ({ page }) => {
  // Manually aging: run the browser clock a year past the last run.
  await page.clock.install({ time: new Date(Date.now() + 365 * 86_400_000) });
  await page.goto('');
  await expect(page.getByTestId('agent-card-macro').locator('[data-status="stale"]').first()).toBeVisible();
});

test('every metro has a static page; unknown routes 404', async ({ page }) => {
  const idx = data<{ metros: { slug: string; name: string }[] }>('real_estate/latest.json');
  const m = idx.metros[idx.metros.length - 1];
  await page.goto(`real-estate/${m.slug}/`);
  await expect(page.locator('h1')).toContainText(m.name);
  const res = await page.goto('does-not-exist/');
  expect(res?.status()).toBe(404);
  await expect(page.getByText("This page doesn't exist")).toBeVisible();
});

test('theme toggle switches and persists', async ({ page }) => {
  await page.goto('');
  await page.getByTestId('theme-toggle').click();
  await page.locator('[data-theme-option="dark"]').click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.getByTestId('theme-toggle').click();
  await page.locator('[data-theme-option="light"]').click();
  await expect(page.locator('html')).not.toHaveClass(/dark/);
});

test('mobile nav opens a sheet', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('');
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.locator('#mobile-nav').getByRole('link', { name: /Macro/ }).click();
  await expect(page).toHaveURL(/\/macro\/$/);
  await expect(page.locator('h1')).toContainText('Macro');
});

test('no page scrolls horizontally at 360px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  for (const r of ROUTES) {
    await page.goto(r);
    await page.waitForLoadState('networkidle');
    const w = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(w, `/${r}`).toBeLessThanOrEqual(360);
  }
});
