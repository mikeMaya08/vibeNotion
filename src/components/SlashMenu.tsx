import React, { useEffect, useRef, useState } from 'react';
import { SLASH_MENU_ITEMS, SlashMenuItem, BlockType } from '../types';

interface Props {
  query: string;
  onSelect: (type: BlockType) => void;
  onClose: () => void;
}

export const SlashMenu: React.FC<Props> = ({ query, onSelect, onClose }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  const filtered = SLASH_MENU_ITEMS.filter(
    (item) =>
      item.label.toLowerCase().includes(query.toLowerCase()) ||
      item.description.toLowerCase().includes(query.toLowerCase()),
  );

  // Reset active index when filter changes
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Keyboard navigation within the menu
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        setActiveIndex((i) => (i + 1) % (filtered.length || 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setActiveIndex((i) => (i - 1 + (filtered.length || 1)) % (filtered.length || 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        if (filtered[activeIndex]) {
          onSelect(filtered[activeIndex].type);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [filtered, activeIndex, onSelect, onClose]);

  // Scroll active item into view
  useEffect(() => {
    const el = menuRef.current?.querySelector(`[data-slash-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  if (filtered.length === 0) {
    return (
      <div className="slash-menu" data-testid="slash-menu" ref={menuRef}>
        <div className="slash-menu-empty">No results</div>
      </div>
    );
  }

  return (
    <div className="slash-menu" data-testid="slash-menu" ref={menuRef} role="listbox">
      {filtered.map((item: SlashMenuItem, index: number) => (
        <div
          key={item.type}
          role="option"
          aria-selected={index === activeIndex}
          data-slash-index={index}
          data-testid={`slash-menu-item-${item.type}`}
          className={`slash-menu-item${index === activeIndex ? ' slash-menu-item--active' : ''}`}
          onMouseEnter={() => setActiveIndex(index)}
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(item.type);
          }}
        >
          <span className="slash-menu-icon">{item.icon}</span>
          <span className="slash-menu-text">
            <span className="slash-menu-label">{item.label}</span>
            <span className="slash-menu-description">{item.description}</span>
          </span>
        </div>
      ))}
    </div>
  );
};
