import { test, expect, Page, Locator } from '@playwright/test';

// Blocks carry dynamically generated ids, so we locate them structurally
// rather than by data-testid.
const blocks = (page: Page): Locator => page.locator('.block-wrapper');
const contents = (page: Page): Locator => page.locator('.block-content');
const focusedContent = (page: Page): Locator =>
  page.locator('.block-wrapper--focused .block-content');

// Types into a block and waits for the local draft to flush into the store
// (data-draft-synced flips back to "true" once the microtask commits). This
// matters before any action that reads block content from the store.
async function typeAndSync(page: Page, blockIndex: number, text: string) {
  await contents(page).nth(blockIndex).click();
  await page.keyboard.type(text);
  await expect(blocks(page).nth(blockIndex)).toHaveAttribute(
    'data-draft-synced',
    'true',
  );
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  // Wait for the document to hydrate past its loading state.
  await expect(page.getByTestId('editor')).toBeVisible();
  await expect(blocks(page)).toHaveCount(1);
});

test('typing into a block persists the text', async ({ page }) => {
  await typeAndSync(page, 0, 'Hello world');
  await expect(contents(page).nth(0)).toHaveText('Hello world');
});

test('Enter creates a new block below and moves focus to it', async ({ page }) => {
  await typeAndSync(page, 0, 'First');
  await page.keyboard.press('Enter');

  await expect(blocks(page)).toHaveCount(2);
  // The newly created block (index 1) receives focus.
  await expect(page.locator('.block-wrapper--focused')).toHaveAttribute(
    'data-block-index',
    '1',
  );

  await expect(focusedContent(page)).toBeFocused();
  await page.keyboard.type('Second');

  await expect(contents(page).nth(0)).toHaveText('First');
  await expect(contents(page).nth(1)).toHaveText('Second');
});

test('Backspace on an empty block merges it into the previous one', async ({ page }) => {
  await typeAndSync(page, 0, 'Hello');
  await page.keyboard.press('Enter');
  await expect(blocks(page)).toHaveCount(2);

  // Backspace on the now-empty second block merges back into the first.
  await page.keyboard.press('Backspace');
  await expect(blocks(page)).toHaveCount(1);
  await expect(contents(page).nth(0)).toHaveText('Hello');
});

test('cursor lands at the merge point after a backspace merge', async ({ page }) => {
  await typeAndSync(page, 0, 'Hello');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Backspace');

  // After the merge the cursor is restored to the join offset (end of "Hello").
  await expect(focusedContent(page)).toBeFocused();
  await page.keyboard.type('X');
  await expect(contents(page).nth(0)).toHaveText('HelloX');
});

test('ArrowUp at the start of a block moves focus to the previous block', async ({ page }) => {
  await typeAndSync(page, 0, 'A');
  await page.keyboard.press('Enter');
  // New empty block, cursor at offset 0.
  await expect(page.locator('.block-wrapper--focused')).toHaveAttribute(
    'data-block-index',
    '1',
  );

  await page.keyboard.press('ArrowUp');
  await expect(page.locator('.block-wrapper--focused')).toHaveAttribute(
    'data-block-index',
    '0',
  );
});

test('the + Add block button appends a block at the end', async ({ page }) => {
  await page.getByTestId('btn-add-block').click();

  await expect(blocks(page)).toHaveCount(2);
  // addBlockAfter focuses the appended block (the new last one).
  await expect(page.locator('.block-wrapper--focused')).toHaveAttribute(
    'data-block-index',
    '1',
  );
});

test('Backspace on the only empty block is a no-op', async ({ page }) => {
  await contents(page).nth(0).click();
  await page.keyboard.press('Backspace');

  await expect(blocks(page)).toHaveCount(1);
  await expect(contents(page).nth(0)).toHaveText('');
});
