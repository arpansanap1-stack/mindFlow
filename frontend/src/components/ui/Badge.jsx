import React from 'react';

/**
 * Restrained semantic badge component.
 * Replaces neon pills with calm stone & category styling.
 */
export default function Badge({
  children,
  variant = 'neutral',
  size = 'sm',
  className = '',
  ...props
}) {
  const base =
    'inline-flex items-center font-medium rounded-md select-none border transition-colors';

  const sizes = {
    xs: 'text-[10px] px-1.5 py-0.2',
    sm: 'text-[11px] px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
  };

  const variants = {
    neutral:
      'bg-[#f4f2ee] text-[#6b6760] border-[#e2ded5] dark:bg-[#282623] dark:text-[#aba59a] dark:border-[#383530]',
    accent:
      'bg-[#edf3ee] text-[#20402d] border-[#a4c0ad] dark:bg-[#1e2e23] dark:text-[#c2d9cb] dark:border-[#35523f]',
    task:
      'bg-[#f4f2ee] text-[#1f1e1d] border-[#e2ded5] dark:bg-[#282623] dark:text-[#ebe8e2] dark:border-[#383530]',
    idea:
      'bg-[#faf5eb] text-[#8c6508] border-[#ebdcb9] dark:bg-[#2c2619] dark:text-[#d4a843] dark:border-[#4d3f24]',
    reminder:
      'bg-[#edf3f7] text-[#2c5364] border-[#bcd0dc] dark:bg-[#1c2930] dark:text-[#79a6be] dark:border-[#2f4652]',
    deadline:
      'bg-[#faeeee] text-[#7d3b2b] border-[#eec5be] dark:bg-[#2d1c1a] dark:text-[#d48372] dark:border-[#4d2c27]',
    'priority-high':
      'bg-[#faeeee] text-[#7d3b2b] border-[#eec5be] font-semibold dark:bg-[#2d1c1a] dark:text-[#d48372]',
    'priority-mid':
      'bg-[#faf5eb] text-[#8c6508] border-[#ebdcb9] font-semibold dark:bg-[#2c2619] dark:text-[#d4a843]',
  };

  return (
    <span
      className={`${base} ${sizes[size] || sizes.sm} ${
        variants[variant] || variants.neutral
      } ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
