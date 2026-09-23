import React from 'react';
import {
  CheckCircle2,
  Circle,
  Clock,
  Calendar,
  Tag,
  Trash2,
  Edit3,
  AlertCircle,
  Sparkles,
} from 'lucide-react';

export default function ItemCard({ item, onComplete, onEdit, onDelete }) {
  const isDone = item.status === 'done';

  const categoryStyles = {
    task: 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-900',
    idea: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-900',
    reminder: 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-900',
    deadline: 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-900',
  };

  const priorityStyles = {
    5: 'bg-red-500 text-white',
    4: 'bg-orange-500 text-white',
    3: 'bg-yellow-500 text-white',
    2: 'bg-blue-400 text-white',
    1: 'bg-slate-400 text-white',
  };

  const formatDeadline = (iso) => {
    if (!iso) return null;
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div
      className={`group relative bg-white dark:bg-slate-900 border rounded-xl p-4 transition-all duration-150 hover:shadow-sm ${
        isDone
          ? 'border-slate-200 dark:border-slate-800 opacity-60 bg-slate-50/50 dark:bg-slate-900/50'
          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Left: Complete toggle & content */}
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <button
            onClick={() => onComplete(item)}
            className="mt-0.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer shrink-0 focus:outline-none"
            title={isDone ? 'Completed' : 'Mark as done'}
            aria-label={isDone ? 'Mark as not done' : 'Mark as done'}
          >
            {isDone ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Circle className="w-5 h-5 hover:scale-110 transition-transform" />
            )}
          </button>

          <div className="flex-1 min-w-0">
            <p
              className={`text-slate-900 dark:text-slate-100 font-medium text-base break-words ${
                isDone ? 'line-through text-slate-500 dark:text-slate-400' : ''
              }`}
            >
              {item.raw_text}
            </p>

            {/* Badges / metadata */}
            <div className="flex flex-wrap items-center gap-1.5 mt-2.5 text-xs">
              {item.category ? (
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full font-medium border text-[11px] capitalize ${
                    categoryStyles[item.category] || 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {item.category}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-medium bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 text-[11px] border border-indigo-200 dark:border-indigo-800/80 animate-pulse">
                  <Sparkles className="w-3 h-3 text-indigo-500 animate-spin" />
                  Classifying...
                </span>
              )}

              {item.priority && (
                <span
                  className={`inline-flex items-center px-1.5 py-0.5 rounded-md font-semibold text-[10px] ${
                    priorityStyles[item.priority] || 'bg-slate-400 text-white'
                  }`}
                  title={`Priority ${item.priority}/5`}
                >
                  P{item.priority}
                </span>
              )}

              {item.est_duration_min && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px]">
                  <Clock className="w-3 h-3 text-slate-400" />
                  {item.est_duration_min}m
                </span>
              )}

              {item.deadline && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 text-[11px]">
                  <Calendar className="w-3 h-3" />
                  {formatDeadline(item.deadline)}
                </span>
              )}

              {item.topic_tag && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[11px]">
                  <Tag className="w-3 h-3 text-slate-400" />
                  #{item.topic_tag}
                </span>
              )}

              {item.status && item.status !== 'inbox' && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium uppercase tracking-wider bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {item.status}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onEdit(item)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Edit item"
            aria-label="Edit item"
          >
            <Edit3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(item.id)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
            title="Delete item"
            aria-label="Delete item"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

