import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle2, Clock, X } from 'lucide-react';

export default function CompleteModal({ item, isOpen, onClose, onConfirm }) {
  const [actualDuration, setActualDuration] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (item && isOpen) {
      setActualDuration(item.est_duration_min ? String(item.est_duration_min) : '');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [item, isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !item) return null;

  const handleComplete = async (duration = null) => {
    setSubmitting(true);
    try {
      await onConfirm(item.id, duration);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="complete-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold">
            <CheckCircle2 className="w-5 h-5" />
            <h2 id="complete-modal-title" className="text-base text-slate-900 dark:text-slate-100">
              Complete Item
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300 font-medium line-clamp-2">
            "{item.raw_text}"
          </p>

          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-2">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              Actual time taken (minutes, optional)
            </label>
            <input
              ref={inputRef}
              type="number"
              min="0"
              placeholder={item.est_duration_min ? `Estimated was ${item.est_duration_min} min` : 'e.g. 25'}
              value={actualDuration}
              onChange={(e) => setActualDuration(e.target.value)}
              className="w-full px-3 py-2 text-base bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <p className="text-xs text-slate-400 mt-1.5">
              Logging actual durations helps MindFlow calibrate your future schedules.
            </p>
          </div>

          {/* Quick preset buttons */}
          <div className="flex items-center gap-2 pt-1">
            {[15, 30, 45, 60].map((mins) => (
              <button
                key={mins}
                type="button"
                onClick={() => setActualDuration(String(mins))}
                className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
              >
                {mins}m
              </button>
            ))}
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              disabled={submitting}
              onClick={() => handleComplete(null)}
              className="px-3.5 py-2 text-xs font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              Skip Duration
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => handleComplete(actualDuration || null)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-xl shadow-sm transition-colors cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Mark Done</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

