import { test, expect } from '@playwright/test';

// Deterministic seed so the target country never changes between runs.
const SEED = 424242;
const BASE = ('/' + (process.env.BASE || '').replace(/^[\/]+|[\/]+$/g, '')).replace(/\/$/, '');

test.describe('Outline gameplay', () => {
  test('typing a country and submitting shows a feedback row, and 6 wrong guesses end the round with stats recorded', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto(`${BASE}/outline/?seed=${SEED}`);
    await expect(page.getByRole('combobox', { name: /guess the country/i })).toBeVisible();

    // A country that is virtually never the answer for any reasonable seed pool member, so this
    // guess is wrong and produces a real distance/direction/proximity feedback row.
    const guessNames = ['Chile', 'Mongolia', 'Kenya', 'Norway', 'Vietnam', 'Peru'];
    for (let i = 0; i < guessNames.length; i++) {
      const box = page.getByRole('combobox', { name: /guess the country/i });
      await box.fill(guessNames[i]);
      const option = page.getByRole('option').first();
      if (await option.count()) {
        await option.click();
      } else {
        await page.getByRole('button', { name: 'Guess' }).click();
      }
      // A feedback row for this guess should appear.
      await expect(page.locator('.guess-row').filter({ hasText: guessNames[i] })).toBeVisible();
      const finished = await page.locator('.result-panel').count();
      if (finished > 0) break;
    }

    await expect(page.locator('.result-panel')).toBeVisible();
    await expect(page.getByRole('status')).toBeVisible();

    // Practice rounds (seed-based) must not show a streak countdown or affect stats.
    await expect(page.getByText('Practice round', { exact: true })).toBeVisible();

    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('the stats modal opens, shows tabs for all three modes, and closes on Escape', async ({ page }) => {
    await page.goto(`${BASE}/outline/`);
    await page.getByRole('button', { name: 'Stats' }).click();
    const dialog = page.getByRole('dialog', { name: /your geostreak stats/i });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('tab', { name: 'Outline' })).toHaveAttribute('aria-selected', 'true');
    await expect(dialog.getByRole('tab', { name: 'Capitals' })).toBeVisible();
    await expect(dialog.getByRole('tab', { name: 'Bigger or smaller' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('reloading mid-round restores guesses instead of resetting the daily puzzle (progress persistence)', async ({ page }) => {
    const today = new Date().toISOString().slice(0, 10);
    await page.goto(`${BASE}/outline/?date=${today}`);
    await expect(page.getByText('Practice round', { exact: true })).toHaveCount(0);
    const box = page.getByRole('combobox', { name: /guess the country/i });
    await box.fill('France');
    const option = page.getByRole('option').first();
    if (await option.count()) await option.click();
    else await page.getByRole('button', { name: 'Guess' }).click();
    await expect(page.locator('.guess-row')).toHaveCount(1);

    await page.reload();
    await expect(page.locator('.guess-row')).toHaveCount(1);
  });

  test('export/import backup code round-trips through the stats modal', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto(`${BASE}/outline/`);
    await page.getByRole('button', { name: 'Stats' }).click();
    await page.getByRole('button', { name: 'Copy backup code' }).click();
    await expect(page.getByText('Code copied')).toBeVisible();
    const code = await page.evaluate(() => navigator.clipboard.readText());
    expect(code.startsWith('GS1:')).toBe(true);

    await page.getByLabel(/restore a backup code/i).fill(code);
    await page.getByRole('button', { name: 'Import', exact: true }).click();
    await expect(page.getByText('Stats restored.')).toBeVisible();
  });
});

test.describe('Capitals gameplay', () => {
  test('answering all 10 rounds reaches a final score', async ({ page }) => {
    await page.goto(`${BASE}/capitals/?seed=${SEED}`);
    for (let i = 0; i < 10; i++) {
      const buttons = page.locator('.choice-btn');
      await expect(buttons.first()).toBeVisible();
      await buttons.first().click();
      await page.waitForTimeout(950);
    }
    await expect(page.locator('.result-panel')).toBeVisible();
    await expect(page.getByText(/you scored \d+\/10/i)).toBeVisible();
  });

  // Regression test for the P0 audit finding: questions and options were swapped, so the correct
  // option's text was always already printed in the question itself (e.g. "What is the capital of
  // Burundi?" offered "Burundi" as an option). After the fix, the two must never overlap.
  test('the correct option is never just a repeat of the question (regression: reverse/options swap)', async ({ page }) => {
    await page.goto(`${BASE}/capitals/?seed=${SEED}`);
    for (let i = 0; i < 10; i++) {
      const heading = (await page.locator('h2').first().innerText()).trim();
      const buttons = page.locator('.choice-btn');
      await expect(buttons.first()).toBeVisible();
      await buttons.first().click();
      const correctText = (await page.locator('.choice-btn--correct').innerText()).trim();
      expect(heading, `round ${i + 1}: "${heading}" vs correct option "${correctText}"`).not.toContain(correctText);
      await page.waitForTimeout(950);
    }
  });

  // Regression test for the audit-2 P1 finding: a reload during the ~850ms post-answer reveal
  // restored a `step` that hadn't advanced yet while `results`/`score` already had, so the same round
  // became answerable again and the score could exceed 10. Only a *daily* round persists progress, so
  // this uses `?date=` (a seed-based practice round is never saved).
  test('a reload during the reveal does not let a round be answered twice (regression: audit-2 P1)', async ({ page }) => {
    const today = new Date().toISOString().slice(0, 10);
    await page.goto(`${BASE}/capitals/?date=${today}`);
    await expect(page.getByText('Practice round', { exact: true })).toHaveCount(0);
    await expect(page.locator('.choice-btn').first()).toBeVisible();
    await page.locator('.choice-btn').first().click();
    // Reload well inside the reveal window, before `step` would have advanced under the old bug.
    await page.waitForTimeout(250);
    await page.reload();
    // Only one round should be recorded — the round shown now must be round 2, not round 1 again.
    await expect(page.getByText('Round 2 of 10', { exact: false })).toBeVisible();
    // 9 rounds remain (round 1 was already committed before the reload above).
    for (let i = 0; i < 9; i++) {
      const buttons = page.locator('.choice-btn');
      await expect(buttons.first()).toBeVisible();
      await buttons.first().click();
      await page.waitForTimeout(950);
    }
    await expect(page.locator('.result-panel')).toBeVisible();
    const scoreText = await page.getByText(/you scored \d+\/10/i).innerText();
    const score = Number(scoreText.match(/you scored (\d+)\/10/i)?.[1]);
    expect(score).toBeLessThanOrEqual(10);
  });
});

test.describe('Bigger or smaller gameplay', () => {
  test('answering all 10 rounds reaches a final score with a combo', async ({ page }) => {
    await page.goto(`${BASE}/bigger/?seed=${SEED}`);
    for (let i = 0; i < 10; i++) {
      const cards = page.locator('.compare-card');
      await expect(cards.first()).toBeVisible();
      await cards.first().click();
      await page.waitForTimeout(2050);
    }
    await expect(page.locator('.result-panel')).toBeVisible();
    await expect(page.getByText(/you scored \d+\/10/i)).toBeVisible();
  });

  // Same regression as the Capitals test above (audit-2 P1), but for Bigger's ~2s reveal window and
  // combo tracking — a reload mid-reveal must not double-count the round or corrupt the combo.
  test('a reload during the reveal does not let a round be answered twice (regression: audit-2 P1)', async ({ page }) => {
    const today = new Date().toISOString().slice(0, 10);
    await page.goto(`${BASE}/bigger/?date=${today}`);
    await expect(page.getByText('Practice round', { exact: true })).toHaveCount(0);
    await expect(page.locator('.compare-card').first()).toBeVisible();
    await page.locator('.compare-card').first().click();
    // Reload well inside the 2s reveal window, before `step` would have advanced under the old bug.
    await page.waitForTimeout(300);
    await page.reload();
    await expect(page.getByText('Round 2 of 10', { exact: false })).toBeVisible();
    // 9 rounds remain (round 1 was already committed before the reload above).
    for (let i = 0; i < 9; i++) {
      const cards = page.locator('.compare-card');
      await expect(cards.first()).toBeVisible();
      await cards.first().click();
      await page.waitForTimeout(2050);
    }
    await expect(page.locator('.result-panel')).toBeVisible();
    const scoreText = await page.getByText(/you scored \d+\/10/i).innerText();
    const score = Number(scoreText.match(/you scored (\d+)\/10/i)?.[1]);
    expect(score).toBeLessThanOrEqual(10);
  });

  // Regression test for an audit-2 P3 finding: the stats modal auto-opened on *every* reload of an
  // already-finished daily round, not just the moment it actually finished.
  test('a finished daily round auto-opens stats once, but not again on reload', async ({ page }) => {
    const today = new Date().toISOString().slice(0, 10);
    await page.goto(`${BASE}/bigger/?date=${today}`);
    for (let i = 0; i < 10; i++) {
      const cards = page.locator('.compare-card');
      await expect(cards.first()).toBeVisible();
      await cards.first().click();
      await page.waitForTimeout(2050);
    }
    await expect(page.locator('.result-panel')).toBeVisible();
    const dialog = page.getByRole('dialog', { name: /your geostreak stats/i });
    await expect(dialog).toBeVisible({ timeout: 2000 }); // auto-opened ~800ms after finishing
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();

    await page.reload();
    await expect(page.locator('.result-panel')).toBeVisible();
    // Give the (now-should-be-skipped) auto-open timeout plenty of time to have fired if it were
    // going to, then assert it did not.
    await page.waitForTimeout(1500);
    await expect(dialog).toBeHidden();
  });
});
