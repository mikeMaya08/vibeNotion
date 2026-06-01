import { test, expect, Page, Locator } from '@playwright/test';

// Mirrors the manual test design "Create, Transform, Persist, and Reload
// Document": type two blocks, transform the second into a heading via the
// slash menu, then reload and confirm everything survived.
//
// KNOWN FAILURE (kept red on purpose as a regression marker):
// This test fails at the "text remains visible after transform/reload" steps
// because of a real bug in the app, NOT a problem with the test. A block's
// contentEditable is only populated imperatively by the sync effect in
// Block.tsx, which short-circuits when block.content === localDraft. On mount
// (and on the remount triggered by the `${id}-${type}` key in BlockList when a
// block is transformed) localDraft is initialized to block.content, so the
// guard returns early and the DOM is never filled. Result: the data is stored
// and persisted correctly (word-count stays 4, data-block-type stays heading1),
// but the text is invisible in the editor. The document title does NOT have
// this bug because Editor.tsx uses a different effect that populates the DOM on
// mount. Fix belongs in Block.tsx (initialize the DOM from block.content on
// mount); once fixed, this test should go green.

const blocks = (page: Page): Locator => page.locator('.block-wrapper');
const contents = (page: Page): Locator => page.locator('.block-content');
const focusedContent = (page: Page): Locator =>
  page.locator('.block-wrapper--focused .block-content');

test('create, transform, persist and reload a document', async ({ page }) => {
  // Step 1 – open the app; it hydrates from an empty store into the editor.
  await page.goto('/');
  await expect(page.getByTestId('editor')).toBeVisible();
  await expect(blocks(page)).toHaveCount(1);

  // Step 2 – type into the first block.
  await contents(page).nth(0).click();
  await page.keyboard.type('Hola mundo');
  await expect(contents(page).nth(0)).toHaveText('Hola mundo');
  await expect(blocks(page).nth(0)).toHaveAttribute('data-draft-synced', 'true');

  // Step 3 – Enter creates a new empty block and moves focus to it.
  await page.keyboard.press('Enter');
  await expect(blocks(page)).toHaveCount(2);
  await expect(page.locator('.block-wrapper--focused')).toHaveAttribute(
    'data-block-index',
    '1',
  );

  // Step 4 – type into the second block.
  await expect(focusedContent(page)).toBeFocused();
  await page.keyboard.type('Segundo bloque');
  await expect(contents(page).nth(1)).toHaveText('Segundo bloque');

  // Step 5 – open the slash command menu from the second block.
  // NOTE: the menu filters by substring, and "h1" is not a substring of
  // "Heading 1", so we type "/h" (matches the heading options) to honor the
  // design's intent of selecting a heading via the menu.
  await page.keyboard.type('/h');
  await expect(page.getByTestId('slash-menu')).toBeVisible();

  // Step 6 – arrow down to the Heading 1 option and select it with Enter.
  await page.keyboard.press('ArrowDown');
  await expect(page.getByTestId('slash-menu-item-heading1')).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.keyboard.press('Enter');

  // The second block becomes a heading; the "/h" command text is stripped and
  // the original text is preserved.
  await expect(blocks(page).nth(1)).toHaveAttribute('data-block-type', 'heading1');
  await expect(contents(page).nth(1)).toHaveText('Segundo bloque');

  // Step 7 – derived counters settle on the correct totals (2 + 2 words).
  await expect(page.getByTestId('status-word-count')).toHaveAttribute(
    'data-value',
    '4',
  );

  // Step 8 – the autosave indicator settles on "saved".
  await expect(page.getByTestId('save-indicator')).toHaveAttribute(
    'data-save-status',
    'saved',
  );

  // Step 9 – reload the page.
  await page.reload();
  await expect(page.getByTestId('editor')).toBeVisible();

  // Step 10 – content, order and the transformed format all persisted.
  await expect(blocks(page)).toHaveCount(2);
  await expect(contents(page).nth(0)).toHaveText('Hola mundo');
  await expect(blocks(page).nth(0)).toHaveAttribute('data-block-index', '0');
  await expect(contents(page).nth(1)).toHaveText('Segundo bloque');
  await expect(blocks(page).nth(1)).toHaveAttribute('data-block-index', '1');
  await expect(blocks(page).nth(1)).toHaveAttribute('data-block-type', 'heading1');
});
