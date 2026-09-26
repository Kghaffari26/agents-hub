import { expect, test } from '@playwright/test';
import { data, trackErrors } from './helpers';

type Idx = { metros: { slug: string; name: string; homes_sold_12m: number }[] };

test('compare flow: 3 metros, metric, range, overlay, map click; URL round-trips', async ({
  page,
  context,
}) => {
  const errors = trackErrors(page);
  const idx = data<Idx>('real_estate/latest.json');
  await page.goto('real-estate/?m='); // start from an explicitly empty selection
  const picker = page.getByTestId('metro-picker').getByRole('combobox');
  await expect(page.getByTestId('metro-chip')).toHaveCount(0);
  const pick = async (name: string) => {
    await picker.fill(name.split(',')[0]);
    await page
      .getByRole('listbox', { name: 'Metros' })
      .getByRole('option', { name: new RegExp(`^${name}`) })
      .first()
      .click();
  };
  const [a, b, c] = [idx.metros[0], idx.metros[1], idx.metros[2]];
  await pick(a.name);
  await pick(b.name);
  await pick(c.name);
  await expect(page.getByTestId('metro-chip')).toHaveCount(3);
  await expect(picker).toBeDisabled();

  await page.getByTestId('metric-toggle').getByRole('radio', { name: 'Inventory' }).click();
  await page.getByTestId('range-toggle').getByRole('radio', { name: '2Y' }).click();
  await page.getByTestId('rate-overlay').check();
  await expect(page).toHaveURL(new RegExp(`m=${a.slug},${b.slug},${c.slug}`));
  await expect(page).toHaveURL(/metric=inventory/);
  await expect(page).toHaveURL(/range=2y/);
  await expect(page).toHaveURL(/rate=1/);
  await expect(page.getByTestId('compare-chart')).toHaveAttribute('aria-label', /Active inventory/);

  // Map marker click replaces the oldest selection when 3 are selected.
  await page.getByTestId('metro-map').scrollIntoViewIfNeeded(); // Leaflet loads when the map nears the viewport
  const markers = page.locator('[data-testid="metro-map"] path.leaflet-interactive');
  await expect(markers.first()).toBeVisible({ timeout: 15_000 });
  const before = await page
    .getByTestId('metro-chip')
    .evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.slug));
  const count = await markers.count();
  for (let i = 0; i < count; i++) {
    await markers.nth(i).click({ force: true });
    const now = await page
      .getByTestId('metro-chip')
      .evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.slug));
    if (now.join() !== before.join()) {
      expect(now).toHaveLength(3);
      expect(now).not.toContain(before[0]);
      break;
    }
  }

  // Reproduce the view in a new tab from the URL.
  const url = page.url();
  const page2 = await context.newPage();
  await page2.goto(url);
  await expect(page2.getByTestId('metro-chip')).toHaveCount(3);
  await expect(page2.getByTestId('metric-toggle').getByRole('radio', { name: 'Inventory' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(page2.getByTestId('range-toggle').getByRole('radio', { name: '2Y' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(page2.getByTestId('rate-overlay')).toBeChecked();
  expect(errors).toEqual([]);
});

test('map has a table fallback; metro deep link preselects', async ({ page }) => {
  await page.goto('real-estate/austin-tx/');
  await expect(page.getByTestId('metro-chip')).toHaveCount(1);
  await expect(page.getByRole('tab', { name: 'Austin' })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('button', { name: 'View as table' }).click();
  await expect(page.getByTestId('map-table').locator('tbody tr')).toHaveCount(
    data<Idx>('real_estate/latest.json').metros.length,
  );
});

test('affordability calculator: $400,000 at 6.5% for 30 years = $2,528.27', async ({ page }) => {
  await page.goto('real-estate/');
  const calc = page.getByTestId('affordability');
  // Wait until the metro file has loaded and set its median as the default price.
  await expect(calc.getByLabel('Home price ($)')).not.toHaveValue('400000');
  await calc.getByLabel('Home price ($)').fill('500000');
  await calc.getByLabel('Interest rate (%)').fill('6.5');
  await expect(calc.getByTestId('calc-pi')).toHaveText('$2,528.27');
});
