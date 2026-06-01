import { test, expect, Page, Locator } from '@playwright/test';

// User Story: "Create and format content using block-based editing"
//   As a user I want to write content and transform blocks using simple
//   commands so that I can structure my document quickly without leaving the
//   keyboard.
//
// One test per acceptance criterion for direct traceability. Assertions target
// USER-FACING behavior (what is visible in the editor), as the story demands.
//
// Two criteria currently FAIL and are kept red on purpose — they expose a real
// bug, not a test problem: a block's contentEditable is only filled imperatively
// by the sync effect in Block.tsx, which short-circuits when
// block.content === localDraft. On mount (and on the `${id}-${type}` remount
// that a transform triggers) localDraft is initialized to block.content, so the
// DOM is never populated. The data is stored/persisted correctly (word counts
// stay right), but the text is invisible after a transform or a reload. This
// directly violates the story's note that "block transformations may internally
// recreate elements, but this should not affect the user experience".

const blocks = (page: Page): Locator => page.locator('.block-wrapper');
const contents = (page: Page): Locator => page.locator('.block-content');
const focusedContent = (page: Page): Locator =>
  page.locator('.block-wrapper--focused .block-content');

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('editor')).toBeVisible();
  await expect(blocks(page)).toHaveCount(1);
});

// Transforms the currently focused block into a heading using only the
// keyboard, after typing the given text into it first.
async function typeAndTransformToHeading(page: Page, text: string) {
  await page.keyboard.type(text);
  await page.keyboard.type('/h'); // "h" matches the Heading options in the menu
  await expect(page.getByTestId('slash-menu')).toBeVisible();
  await page.keyboard.press('ArrowDown'); // move from "Text" to "Heading 1"
  await expect(page.getByTestId('slash-menu-item-heading1')).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.keyboard.press('Enter');
}

test.describe('Block creation', () => {
  test('user can type text into an empty block', async ({ page }) => {
    await contents(page).nth(0).click();
    await page.keyboard.type('Texto inicial');
    await expect(contents(page).nth(0)).toHaveText('Texto inicial');
  });

  test('pressing Enter creates a new block below', async ({ page }) => {
    await contents(page).nth(0).click();
    await page.keyboard.type('Bloque uno');
    await expect(blocks(page).nth(0)).toHaveAttribute('data-draft-synced', 'true');
    await page.keyboard.press('Enter');
    await expect(blocks(page)).toHaveCount(2);
    await expect(page.locator('.block-wrapper--focused')).toHaveAttribute(
      'data-block-index',
      '1',
    );
  });
});

test.describe('Editing content', () => {
  test('text appears immediately as the user types', async ({ page }) => {
    await contents(page).nth(0).click();
    await page.keyboard.type('Aparece al instante');
    await expect(contents(page).nth(0)).toHaveText('Aparece al instante');
  });

  test('user can navigate between blocks using the keyboard', async ({ page }) => {
    await contents(page).nth(0).click();
    await page.keyboard.type('Primero');
    await expect(blocks(page).nth(0)).toHaveAttribute('data-draft-synced', 'true');
    await page.keyboard.press('Enter'); // now on block 1 (empty, cursor at 0)
    await expect(page.locator('.block-wrapper--focused')).toHaveAttribute(
      'data-block-index',
      '1',
    );

    // ArrowUp from the start of the empty block jumps to the previous block.
    await page.keyboard.press('ArrowUp');
    await expect(page.locator('.block-wrapper--focused')).toHaveAttribute(
      'data-block-index',
      '0',
    );
    // ArrowDown only descends when the caret is at the end of the text, so move
    // the caret to the end first, then navigate back down.
    await page.keyboard.press('End');
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('.block-wrapper--focused')).toHaveAttribute(
      'data-block-index',
      '1',
    );
  });
});

test.describe('Slash command menu', () => {
  test('typing "/" opens the command menu', async ({ page }) => {
    await contents(page).nth(0).click();
    await page.keyboard.type('/');
    await expect(page.getByTestId('slash-menu')).toBeVisible();
    // Several formatting options are offered.
    await expect(page.getByTestId('slash-menu-item-heading1')).toBeVisible();
    await expect(page.getByTestId('slash-menu-item-bullet')).toBeVisible();
  });

  test('the menu filters options based on input', async ({ page }) => {
    await contents(page).nth(0).click();
    await page.keyboard.type('/code');
    await expect(page.getByTestId('slash-menu')).toBeVisible();
    await expect(page.getByTestId('slash-menu-item-code')).toBeVisible();
    // Non-matching options are filtered out.
    await expect(page.getByTestId('slash-menu-item-heading1')).toHaveCount(0);
    await expect(page.getByTestId('slash-menu-item-quote')).toHaveCount(0);
  });

  test('user can navigate options using arrow keys', async ({ page }) => {
    await contents(page).nth(0).click();
    await page.keyboard.type('/h');
    await expect(page.getByTestId('slash-menu')).toBeVisible();
    // First option is active by default.
    await expect(page.getByTestId('slash-menu-item-text')).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await page.keyboard.press('ArrowDown');
    await expect(page.getByTestId('slash-menu-item-heading1')).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  test('pressing Enter applies the selected transformation', async ({ page }) => {
    await contents(page).nth(0).click();
    await typeAndTransformToHeading(page, 'Encabezado');
    await expect(blocks(page).nth(0)).toHaveAttribute('data-block-type', 'heading1');
  });
});

test.describe('Block transformation', () => {
  test('the selected block changes its type (paragraph -> heading)', async ({ page }) => {
    await contents(page).nth(0).click();
    await typeAndTransformToHeading(page, 'Titulo');
    await expect(blocks(page).nth(0)).toHaveAttribute('data-block-type', 'heading1');
    await expect(page.locator('h1.block-content--heading1')).toBeVisible();
  });

  test('the change is reflected immediately in the UI', async ({ page }) => {
    await contents(page).nth(0).click();
    await typeAndTransformToHeading(page, 'Inmediato');
    // The heading element is rendered right away.
    await expect(page.locator('h1.block-content--heading1')).toBeVisible();
  });

  // FAILS: real bug — text vanishes from the DOM after the transform remount.
  test('the existing text content is preserved after a transform', async ({ page }) => {
    await contents(page).nth(0).click();
    await typeAndTransformToHeading(page, 'Contenido importante');
    await expect(contents(page).nth(0)).toHaveText('Contenido importante', {
      timeout: 3000,
    });
  });
});

test.describe('User experience', () => {
  test('focus remains in the editor after a transformation', async ({ page }) => {
    await contents(page).nth(0).click();
    await typeAndTransformToHeading(page, 'Con foco');
    await expect(focusedContent(page)).toBeFocused();
  });

  test('the full flow can be completed using only the keyboard', async ({ page }) => {
    await contents(page).nth(0).click();
    await page.keyboard.type('Primer bloque');
    await expect(blocks(page).nth(0)).toHaveAttribute('data-draft-synced', 'true');
    await page.keyboard.press('Enter');
    await expect(focusedContent(page)).toBeFocused();
    await typeAndTransformToHeading(page, 'Segundo bloque');

    // Structural outcome of the keyboard-only flow.
    await expect(blocks(page)).toHaveCount(2);
    await expect(blocks(page).nth(1)).toHaveAttribute('data-block-type', 'heading1');
    await expect(focusedContent(page)).toBeFocused();
  });
});

test.describe('Definition of Done', () => {
  // FAILS: real bug — content is stored/persisted but not rendered after reload.
  test('the feature works after a page reload (content persists)', async ({ page }) => {
    await contents(page).nth(0).click();
    await page.keyboard.type('Persistente');
    await expect(page.getByTestId('save-indicator')).toHaveAttribute(
      'data-save-status',
      'saved',
    );

    await page.reload();
    await expect(page.getByTestId('editor')).toBeVisible();
    await expect(contents(page).nth(0)).toHaveText('Persistente', { timeout: 3000 });
  });
});
