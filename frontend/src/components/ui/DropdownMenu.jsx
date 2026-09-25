import React, { useState, useRef, useEffect } from 'react';

/**
 * Lightweight contextual dropdown menu with keyboard support.
 */
export default function DropdownMenu({
  trigger,
  items = [],
  align = 'right',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const alignStyles = align === 'left' ? 'left-0' : 'right-0';

  return (
    <div className="relative inline-block text-left" ref={containerRef}>
      <div onClick={() => setIsOpen(!isOpen)} className="cursor-pointer">
        {trigger}
      </div>

      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          className={`absolute ${alignStyles} mt-1 w-44 rounded-xl bg-[#ffffff] dark:bg-[#1f1e1d] border border-[#e2ded5] dark:border-[#383530] shadow-lg py-1 z-30 animate-in fade-in duration-100`}
        >
          {items.map((item, idx) => {
            if (item.divider) {
              return (
                <div
                  key={idx}
                  className="my-1 border-t border-[#e2ded5] dark:border-[#383530]"
                />
              );
            }

            const Icon = item.icon;

            return (
              <button
                key={idx}
                role="menuitem"
                onClick={() => {
                  setIsOpen(false);
                  item.onClick?.();
                }}
                disabled={item.disabled}
                className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  item.danger
                    ? 'text-[#7d3b2b] hover:bg-[#7d3b2b]/10 dark:text-[#d48372]'
                    : 'text-[#1f1e1d] dark:text-[#ebe8e2] hover:bg-[#f4f2ee] dark:hover:bg-[#282623]'
                }`}
              >
                {Icon && <Icon className="w-3.5 h-3.5 opacity-70 shrink-0" />}
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
