import React from 'react';

/**
 * Thoughtful, human empty state component.
 */
export default function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className = '',
}) {
  return (
    <div
      className={`text-center py-12 px-4 border border-dashed border-[#e2ded5] dark:border-[#383530] rounded-2xl bg-[#fbfaf8]/60 dark:bg-[#1f1e1d]/40 ${className}`}
    >
      {Icon && (
        <div className="w-10 h-10 rounded-xl bg-[#f4f2ee] dark:bg-[#282623] text-[#2d553c] dark:text-[#5b8a6c] mx-auto flex items-center justify-center mb-3 border border-[#e2ded5] dark:border-[#383530]">
          <Icon className="w-5 h-5" />
        </div>
      )}
      <h3 className="text-sm font-semibold text-[#1f1e1d] dark:text-[#ebe8e2] mb-1">
        {title}
      </h3>
      <p className="text-xs text-[#6b6760] dark:text-[#aba59a] max-w-sm mx-auto leading-relaxed">
        {description}
      </p>
      {actionLabel && onAction && (
        <div className="mt-4">
          <button
            onClick={onAction}
            className="inline-flex items-center text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#2d553c] hover:bg-[#23432f] text-white transition-colors cursor-pointer"
          >
            {actionLabel}
          </button>
        </div>
      )}
    </div>
  );
}
