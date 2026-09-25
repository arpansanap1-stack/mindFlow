/**
 * MindFlow Design System Tokens
 * 
 * Calm, human-designed, eye-comfortable aesthetic.
 * Base: Warm off-white / soft stone, dark charcoal text, muted warm gray secondary.
 * Accent: Restrained deep earthy sage (#2d553c).
 * Semantic status colors only for success, warning, error, urgency.
 */

export const colors = {
  canvas: 'var(--bg-canvas)',
  surface: 'var(--bg-surface)',
  surfaceHover: 'var(--bg-surface-hover)',
  subtle: 'var(--bg-subtle)',
  elevated: 'var(--bg-elevated)',
  
  borderSubtle: 'var(--border-subtle)',
  borderDefault: 'var(--border-default)',
  borderFocus: 'var(--border-focus)',
  
  textPrimary: 'var(--text-primary)',
  textSecondary: 'var(--text-secondary)',
  textMuted: 'var(--text-muted)',
  textInverse: 'var(--text-inverse)',
  
  accent: 'var(--accent)',
  accentHover: 'var(--accent-hover)',
  accentSubtle: 'var(--accent-subtle)',
  accentBorder: 'var(--accent-border)',
  accentText: 'var(--accent-text)',
};

/**
 * Category styling tokens - restrained, muted, not rainbow pills
 */
export const categoryTokens = {
  task: {
    label: 'Task',
    bg: 'bg-stone-100 dark:bg-stone-800/80',
    text: 'text-stone-700 dark:text-stone-300',
    border: 'border-stone-200/80 dark:border-stone-700/80',
  },
  idea: {
    label: 'Idea',
    bg: 'bg-amber-50/70 dark:bg-amber-950/40',
    text: 'text-amber-800 dark:text-amber-300',
    border: 'border-amber-200/70 dark:border-amber-800/60',
  },
  reminder: {
    label: 'Reminder',
    bg: 'bg-blue-50/60 dark:bg-blue-950/40',
    text: 'text-blue-800 dark:text-blue-300',
    border: 'border-blue-200/60 dark:border-blue-800/60',
  },
  deadline: {
    label: 'Deadline',
    bg: 'bg-rose-50/70 dark:bg-rose-950/40',
    text: 'text-rose-800 dark:text-rose-300',
    border: 'border-rose-200/70 dark:border-rose-800/60',
  },
};

/**
 * Priority levels: minimal indicator, only highlighting high urgency
 */
export const priorityTokens = {
  5: {
    label: 'Critical',
    dot: 'bg-red-500',
    text: 'text-red-700 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-950/50',
    border: 'border-red-200 dark:border-red-900',
  },
  4: {
    label: 'High',
    dot: 'bg-amber-500',
    text: 'text-amber-700 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-950/50',
    border: 'border-amber-200 dark:border-amber-900',
  },
  3: {
    label: 'Medium',
    dot: 'bg-stone-400',
    text: 'text-stone-600 dark:text-stone-400',
    bg: 'bg-stone-100 dark:bg-stone-800',
    border: 'border-stone-200 dark:border-stone-700',
  },
  2: {
    label: 'Low',
    dot: 'bg-stone-300',
    text: 'text-stone-500 dark:text-stone-400',
    bg: 'bg-stone-100 dark:bg-stone-800',
    border: 'border-stone-200 dark:border-stone-700',
  },
  1: {
    label: 'Minimal',
    dot: 'bg-stone-200',
    text: 'text-stone-400 dark:text-stone-500',
    bg: 'bg-stone-50 dark:bg-stone-900',
    border: 'border-stone-100 dark:border-stone-800',
  },
};
