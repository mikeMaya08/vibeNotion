import { test, expect } from '@playwright/test';
import { EditorPage } from './pages/EditorPage';

// ─────────────────────────────────────────────────────────────────────────────
// Suite 1 — Edición de contenido en bloques
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Content editing', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.goto();
  });

  test('should display the editor with at least one empty block on load', async () => {
    await expect(editor.blockList).toBeVisible();
    await expect(editor.firstBlockContent).toBeVisible();
    await expect(editor.firstBlockContent).toHaveAttribute(
      'data-placeholder',
      "Type '/' for commands…"
    );
  });

  test('should allow typing text into the first block', async () => {
    await editor.typeInFirstBlock('Hello VibeNotion');
    await expect(editor.firstBlockContent).toHaveText('Hello VibeNotion');
  });

  test('should update the word count in the status bar after typing', async () => {
    await editor.typeInFirstBlock('Hello world');
    await expect(editor.wordCount).toHaveAttribute('data-value', '2', { timeout: 2000 });
  });

  test('should update the character count in the status bar after typing', async () => {
    await editor.typeInFirstBlock('Hello');
    await expect(editor.charCount).toHaveAttribute('data-value', '5', { timeout: 2000 });
  });

  test('should allow editing the document title', async () => {
    await editor.typeInTitle('My Test Document');
    await expect(editor.documentTitle).toHaveText('My Test Document');
  });

  test('should focus the first block when pressing Enter on the title', async ({ page }) => {
    await editor.documentTitle.click();
    await page.keyboard.press('Enter');
    await expect(editor.firstBlockContent).toBeFocused();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 2 — Guardado automático (Save Indicator)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Autosave', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.goto();
  });

  test('should show "Saving…" indicator immediately when content changes', async () => {
    await editor.typeInFirstBlock('Triggering autosave');
    await expect(editor.saveIndicator).toHaveAttribute('data-save-status', 'saving');
  });

  test('should transition from "saving" to "saved" after the debounce', async () => {
    await editor.typeInFirstBlock('Autosave test content');
    await editor.waitForSaved();
    await expect(editor.saveIndicator).toHaveText('Saved');
  });

  test('should show "Saving…" when the title is changed', async () => {
    await editor.typeInTitle('New title triggers save');
    await expect(editor.saveIndicator).toHaveAttribute('data-save-status', 'saving');
  });

  test('should reach "saved" state after editing the title', async () => {
    await editor.typeInTitle('Persisted title');
    await editor.waitForSaved();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite 3 — Persistencia (contenido sobrevive a un reload)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Persistence across page reload', () => {
  let editor: EditorPage;

  test.beforeEach(async ({ page }) => {
    editor = new EditorPage(page);
    await editor.goto();
  });

  test('should persist block content after a full page reload', async ({ page }) => {
    await editor.typeInFirstBlock('Persisted block content');
    await editor.waitForSaveAndSettle();

    await page.reload();
    await editor.waitForEditor();

    await expect(editor.firstBlockContent).toHaveText('Persisted block content');
  });

  test('should persist document title after a full page reload', async ({ page }) => {
    await editor.clearTitle();
    await editor.typeInTitle('My Persisted Title');
    await editor.waitForSaveAndSettle();

    await page.reload();
    await editor.waitForEditor();

    await expect(editor.documentTitle).toHaveText('My Persisted Title');
  });
});
