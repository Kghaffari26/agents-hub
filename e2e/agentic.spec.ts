import { expect, test } from '@playwright/test';
import { data, trackErrors } from './helpers';

type Trace = { spans: unknown[]; summary: { llm_calls: number } };

for (const [route, agent] of [
  ['real-estate/', 'real_estate'],
  ['macro/', 'macro'],
  ['grants/', 'grants'],
  ['repos/', 'repo_maint'],
] as const) {
  test(`/${route} run trace opens as a timeline and a text table`, async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto(route);
    const panel = page.getByTestId('run-trace');
    await expect(panel.getByRole('heading', { name: 'Run trace' })).toBeVisible();
    let t: Trace | null = null;
    try {
      t = data<Trace>(`${agent}/trace.json`);
    } catch {
      /* agent published no trace: the panel says so */
    }
    if (!t) {
      await expect(panel).toContainText(/No trace yet|wasn't published/);
      return;
    }
    await expect(panel.getByTestId('trace-summary')).toContainText(String(t.summary.llm_calls));
    await panel.getByTestId('trace-details').locator('summary').click();
    await expect(panel.getByTestId('trace-timeline')).toBeVisible();
    await panel.getByTestId('trace-view-toggle').getByRole('radio', { name: 'Table' }).click();
    const rows = panel.getByTestId('trace-table').locator('tbody tr');
    await expect(rows).toHaveCount(Math.min(t.spans.length, 120));
    // Keyboard: the view toggle is a radiogroup driven by arrow keys.
    await panel.getByTestId('trace-view-toggle').getByRole('radio', { name: 'Table' }).press('ArrowLeft');
    await expect(panel.getByTestId('trace-timeline')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test(`/${route} evals section shows latest scores and a chart`, async ({ page }) => {
    await page.goto(route);
    const section = page.getByTestId('evals-section');
    await expect(section.getByTestId('evals-latest')).toBeVisible();
    await section.scrollIntoViewIfNeeded();
    await expect(section.getByTestId('evals-chart')).toBeVisible();
    await section.getByRole('button', { name: 'View data table' }).click();
    await expect(section.locator('table').nth(1)).toBeVisible();
  });
}

test('agentic outputs render on each agent page', async ({ page }) => {
  const re = data<{ investigations?: { slug: string }[] }>('real_estate/latest.json');
  await page.goto('real-estate/');
  if (re.investigations?.length) {
    await expect(page.getByTestId('investigation-card')).toHaveCount(re.investigations.length);
    await page
      .getByTestId('investigation-card')
      .first()
      .getByRole('link', { name: 'Full explanation' })
      .click();
    await expect(page).toHaveURL(new RegExp(`/real-estate/${re.investigations[0].slug}/$`));
    await expect(page.getByTestId('investigation-focus')).toBeVisible();
  }

  const macro = data<{ investigation?: { cited_series?: unknown[] } | null }>('macro/latest.json');
  await page.goto('macro/');
  if (macro.investigation) {
    await expect(page.getByTestId('whats-driving')).toBeVisible();
    await expect(page.getByTestId('driving-trigger')).toContainText('Trigger:');
  }

  const grants = data<{ top_matches: { research?: unknown }[] }>('grants/latest.json');
  await page.goto('grants/');
  if (grants.top_matches.some((m) => m.research)) {
    const br = page.getByTestId('bid-research').first();
    await br.locator('> summary').click();
    await expect(br.getByTestId('usaspending-citations').getByRole('link').first()).toBeVisible();
  }

  const repos = data<{ repos: { fix_proposals?: { status: string }[] }[] }>('repo_maint/latest.json');
  const fixes = repos.repos.flatMap((r) => r.fix_proposals ?? []);
  await page.goto('repos/');
  if (fixes.length) {
    await expect(page.getByTestId('fix-proposal')).toHaveCount(fixes.length);
    if (fixes.some((f) => f.status === 'proposed')) {
      await expect(page.getByTestId('fix-status').first()).toContainText('awaiting human review');
      await expect(page.getByTestId('diff-preview').first()).toContainText('diff --git');
    }
  } else {
    await expect(page.getByText('No fix proposals this run.')).toBeVisible();
  }
});

test('case studies render one section per agent, sanitized', async ({ page }) => {
  await page.goto('case-studies/');
  await expect(page.getByTestId('case-study')).toHaveCount(4);
  await expect(page.locator('main script')).toHaveCount(0);
  await page.getByRole('navigation', { name: 'Case studies by agent' }).getByRole('link').nth(2).click();
  await expect(page).toHaveURL(/#cs-grants$/);
});

test('mcp page has copyable install snippets and example conversations', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('mcp/');
  await expect(page.getByTestId('mcp-conversation')).toHaveCount(3);
  await expect(page.getByTestId('mcp-tools').locator('tbody tr')).toHaveCount(13);
  const install = page.getByTestId('mcp-install');
  await install.getByRole('button', { name: /Copy.*Claude Code/ }).click();
  await expect(install.getByText('Copied').first()).toBeVisible();
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  expect(clip).toBe(
    'claude mcp add agents-hub -- uvx --from git+https://github.com/Kghaffari26/agents-mcp agents-mcp',
  );
});

test('about charts eval history for every agent and the MCP server', async ({ page }) => {
  await page.goto('about/');
  await expect(page.getByTestId('about-evals').getByTestId('evals-section')).toHaveCount(5);
});
