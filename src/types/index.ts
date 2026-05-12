export type BlockType = 'text' | 'heading1' | 'heading2' | 'heading3' | 'bullet' | 'numbered' | 'code' | 'quote';

export interface Block {
  id: string;
  type: BlockType;
  content: string;
  indent: number;
}

export interface Document {
  id: string;
  title: string;
  blocks: Block[];
  createdAt: number;
  updatedAt: number;
}

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface HistoryEntry {
  blocks: Block[];
  focusedBlockId: string | null;
}

export interface SlashMenuItem {
  label: string;
  description: string;
  type: BlockType;
  icon: string;
}

export const SLASH_MENU_ITEMS: SlashMenuItem[] = [
  { label: 'Text', description: 'Plain text paragraph', type: 'text', icon: '¶' },
  { label: 'Heading 1', description: 'Large section heading', type: 'heading1', icon: 'H1' },
  { label: 'Heading 2', description: 'Medium section heading', type: 'heading2', icon: 'H2' },
  { label: 'Heading 3', description: 'Small section heading', type: 'heading3', icon: 'H3' },
  { label: 'Bullet List', description: 'Unordered list item', type: 'bullet', icon: '•' },
  { label: 'Numbered List', description: 'Ordered list item', type: 'numbered', icon: '1.' },
  { label: 'Code Block', description: 'Monospace code block', type: 'code', icon: '</>' },
  { label: 'Quote', description: 'Blockquote callout', type: 'quote', icon: '"' },
];

export const DOC_ID = 'main-document';
