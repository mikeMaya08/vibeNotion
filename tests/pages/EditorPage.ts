import { Page, Locator, expect } from '@playwright/test';
import { BASE_URL, AUTOSAVE_DEBOUNCE_MS, SAVE_TIMEOUT_MS } from '../constants';

export class EditorPage {
  readonly page: Page;

  // Selectores raíz
  readonly editor: Locator;
  readonly toolbar: Locator;
  readonly documentTitle: Locator;
  readonly blockList: Locator;
  readonly addBlockBtn: Locator;
  readonly saveIndicator: Locator;
  readonly statusBar: Locator;

  // Status bar
  readonly wordCount: Locator;
  readonly charCount: Locator;
  readonly blockCount: Locator;
  readonly lastEdited: Locator;

  // Toolbar buttons
  readonly undoBtn: Locator;
  readonly redoBtn: Locator;

  constructor(page: Page) {
    this.page = page;

    this.editor        = page.getByTestId('editor');
    this.toolbar       = page.getByTestId('editor-toolbar');
    this.documentTitle = page.getByTestId('document-title');
    this.blockList     = page.getByTestId('block-list');
    this.addBlockBtn   = page.getByTestId('btn-add-block');
    this.saveIndicator = page.getByTestId('save-indicator');
    this.statusBar     = page.getByTestId('status-bar');
    this.wordCount     = page.getByTestId('status-word-count');
    this.charCount     = page.getByTestId('status-char-count');
    this.blockCount    = page.getByTestId('status-block-count');
    this.lastEdited    = page.getByTestId('status-last-edited');
    this.undoBtn       = page.getByTestId('btn-undo');
    this.redoBtn       = page.getByTestId('btn-redo');
  }

  // ── Navigation ─────────────────────────────────────────────────────────────

  async goto() {
    await this.page.goto(BASE_URL);
    await this.waitForEditor();
  }

  // ── Waits ──────────────────────────────────────────────────────────────────

  async waitForEditor() {
    await expect(this.editor).toBeVisible();
  }

  async waitForSaved() {
    await expect(this.saveIndicator).toHaveAttribute('data-save-status', 'saved', {
      timeout: SAVE_TIMEOUT_MS,
    });
  }

  async waitForSaveAndSettle() {
    await this.waitForSaved();
    await this.page.waitForTimeout(AUTOSAVE_DEBOUNCE_MS);
  }

  // ── Block helpers ──────────────────────────────────────────────────────────

  getBlockContent(blockId: string): Locator {
    return this.page.getByTestId(`block-content-${blockId}`);
  }

  getBlockRow(blockId: string): Locator {
    return this.page.getByTestId(`block-row-${blockId}`);
  }

  getDragHandle(blockId: string): Locator {
    return this.page.getByTestId(`drag-handle-${blockId}`);
  }

  /** Devuelve el primer bloque de contenido de la lista */
  get firstBlockContent(): Locator {
    return this.blockList
      .locator('[data-testid^="block-content-"]')
      .first();
  }

  /** Devuelve todos los bloques de contenido de la lista */
  get allBlockContents(): Locator {
    return this.blockList.locator('[data-testid^="block-content-"]');
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  async typeInFirstBlock(text: string) {
    await this.firstBlockContent.click();
    await this.page.keyboard.type(text);
  }

  async typeInTitle(text: string) {
    await this.documentTitle.click();
    await this.page.keyboard.type(text);
  }

  async clearTitle() {
    await this.documentTitle.click();
    await this.page.keyboard.press('Control+A');
    await this.page.keyboard.press('Delete');
  }

  async clickAddBlock() {
    await this.addBlockBtn.click();
  }

  async clickUndo() {
    await this.undoBtn.click();
  }

  async clickRedo() {
    await this.redoBtn.click();
  }
}
