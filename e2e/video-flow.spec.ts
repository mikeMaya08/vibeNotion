import { test, expect, Page, Locator } from '@playwright/test';

// Replicates the flow captured in the screen recording 20260601143119666.mp4
// (recorded against the deployed app at vibenotion.vercel.app). The recording
// shows, in order:
//   1. The user types a line of text into a block; it autosaves ("Saved").
//   2. The user reloads the page — and the text they just typed DISAPPEARS from
//      the editor, even though the status-bar counters (words/chars/blocks) stay
//      exactly as they were. The data is persisted; it is simply never rendered
//      back into the contentEditable.
//   3. The user then adds a new block and types more text ("nothing"), which
//      shows up live while typing.
//
// We reproduce the same sequence against the local dev server starting from a
// fresh document (a single empty block) so the flow is deterministic.
//
// KNOWN FAILURE (kept red on purpose as a regression marker): the assertion
// that the typed text is still VISIBLE after the reload fails — this is the
// exact bug the video demonstrates, not a test problem. The root cause is the
// sync effect in Block.tsx, which short-circuits when block.content ===
// localDraft and therefore never populates the DOM on mount/hydration. Note how
// the char-count assertion right next to it still passes: the store kept the
// data, only the rendering is broken. Fix belongs in Block.tsx; once fixed this
// test should go green.

const blocks = (page: Page): Locator => page.locator('.block-wrapper');
const contents = (page: Page): Locator => page.locator('.block-content');
const focusedContent = (page: Page): Locator =>
  page.locator('.block-wrapper--focused .block-content');

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('editor')).toBeVisible();
  await expect(blocks(page)).toHaveCount(1);
});

test('type, reload (content survives), then add a block and keep typing', async ({
  page,
}) => {
  // Step 1 – type a line of text into the first block (mirrors "Temporary text").
  await contents(page).nth(0).click();
  await page.keyboard.type('Temporary text');
  await expect(contents(page).nth(0)).toHaveText('Temporary text');

  // The status bar settles on the derived totals (2 words, 14 chars, 1 block)…
  await expect(page.getByTestId('status-word-count')).toHaveAttribute(
    'data-value',
    '2',
  );
  await expect(page.getByTestId('status-char-count')).toHaveAttribute(
    'data-value',
    '14',
  );
  // …and autosave reports success before we reload.
  await expect(page.getByTestId('save-indicator')).toHaveAttribute(
    'data-save-status',
    'saved',
  );

  // Step 2 – reload. The recording shows the text vanishing here while the
  // counters stay put.
  await page.reload();
  await expect(page.getByTestId('editor')).toBeVisible();
  await expect(blocks(page)).toHaveCount(1);

  // The data clearly survived: the char count is still 14.
  await expect(page.getByTestId('status-char-count')).toHaveAttribute(
    'data-value',
    '14',
  );
  // …but the user should ALSO still see it. This is the bug from the video.
  await expect(contents(page).nth(0)).toHaveText('Temporary text', {
    timeout: 3000,
  });

  // Step 3 – add a new block via the button and type into it ("nothing").
  await page.getByTestId('btn-add-block').click();
  await expect(blocks(page)).toHaveCount(2);
  await expect(focusedContent(page)).toBeFocused();

  await page.keyboard.type('nothing');
  await expect(contents(page).nth(1)).toHaveText('nothing');

  // Live typing in the new block is reflected immediately in the totals.
  await expect(page.getByTestId('status-block-count')).toHaveAttribute(
    'data-value',
    '2',
  );
  await expect(page.getByTestId('save-indicator')).toHaveAttribute(
    'data-save-status',
    'saved',
  );
});
