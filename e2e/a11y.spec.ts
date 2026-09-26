import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { ROUTES } from './helpers';

for (const theme of ['light', 'dark'] as const) {
  for (const route of ROUTES) {
    test(`axe: /${route} (${theme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^(?!.*dark)/);
      const results =
        await // @axe-core/playwright bundles a newer playwright-core; the Page API it uses is compatible.
        new AxeBuilder({ page: page as unknown as ConstructorParameters<typeof AxeBuilder>[0]['page'] })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .exclude('.leaflet-container') // third-party map; the table fallback is tested instead
          .analyze();
      const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      expect(
        serious.map(
          (v) =>
            `${v.id}: ${v.help} → ${v.nodes
              .slice(0, 3)
              .map((n) => n.target.join(' '))
              .join(' | ')}`,
        ),
      ).toEqual([]);
    });
  }
}
