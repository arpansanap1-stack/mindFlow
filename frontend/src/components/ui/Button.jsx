import React from 'react';

/**
 * Reusable calm button component.
 * Variants: primary (earthy sage), secondary (warm stone), outline, ghost, danger.
 */
export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  className = '',
  type = 'button',
  onClick,
  ...props
}) {
  const baseStyles =
    'inline-flex items-center justify-center font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed select-none focus:outline-none';

  const sizeStyles = {
    sm: 'text-xs px-2.5 py-1.5 rounded-lg gap-1.5',
    md: 'text-xs sm:text-sm px-3.5 py-2 rounded-xl gap-2',
    lg: 'text-sm px-5 py-2.5 rounded-xl gap-2.5',
  };

  const variantStyles = {
    primary:
      'bg-[#2d553c] hover:bg-[#23432f] active:bg-[#1c3525] text-white dark:bg-[#5b8a6c] dark:hover:bg-[#4d775c] shadow-xs',
    secondary:
      'bg-[#f4f2ee] hover:bg-[#eae6df] text-[#1f1e1d] dark:bg-[#282623] dark:hover:bg-[#322f2b] dark:text-[#ebe8e2] border border-[#e2ded5] dark:border-[#383530]',
    outline:
      'border border-[#d1ccbf] hover:border-[#1f1e1d] text-[#1f1e1d] bg-transparent dark:border-[#4a4640] dark:text-[#ebe8e2] dark:hover:border-[#ebe8e2]',
    ghost:
      'text-[#6b6760] hover:text-[#1f1e1d] hover:bg-[#f4f2ee] dark:text-[#aba59a] dark:hover:text-[#ebe8e2] dark:hover:bg-[#282623]',
    danger:
      'bg-[#7d3b2b]/10 text-[#7d3b2b] hover:bg-[#7d3b2b]/20 dark:text-[#d48372] dark:hover:bg-[#7d3b2b]/30 border border-[#7d3b2b]/20',
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`${baseStyles} ${sizeStyles[size] || sizeStyles.md} ${
        variantStyles[variant] || variantStyles.primary
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
