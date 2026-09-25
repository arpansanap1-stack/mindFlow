import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle2, Clock } from 'lucide-react';
import Modal from './ui/Modal';
import Button from './ui/Button';

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

  if (!isOpen || !item) return null;

  const handleComplete = async (duration = null) => {
    setSubmitting(true);
    try {
      await onConfirm(item.id, duration ? Number(duration) : null);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Complete Task"
      maxWidth="max-w-md"
    >
      <div className="space-y-4 text-xs">
        <p className="text-sm text-[#1f1e1d] dark:text-[#ebe8e2] font-medium line-clamp-2">
          "{item.raw_text}"
        </p>

        <div>
          <label className="flex items-center gap-1.5 font-medium text-[#1f1e1d] dark:text-[#ebe8e2] mb-1.5">
            <Clock className="w-3.5 h-3.5 text-[#6b6760] dark:text-[#9e998f]" />
            Actual time taken (minutes, optional)
          </label>
          <input
            ref={inputRef}
            type="number"
            min="0"
            placeholder={item.est_duration_min ? `Estimated was ${item.est_duration_min} min` : 'e.g. 25'}
            value={actualDuration}
            onChange={(e) => setActualDuration(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-[#ffffff] dark:bg-[#1f1e1d] border border-[#e2ded5] dark:border-[#383530] rounded-lg text-[#1f1e1d] dark:text-[#ebe8e2] focus:outline-none focus:ring-1 focus:ring-[#2d553c]"
          />
          <p className="text-[11px] text-[#6b6760] dark:text-[#9e998f] mt-1">
            Logging actual times helps MindFlow make future schedules more accurate.
          </p>
        </div>

        {/* Quick preset buttons */}
        <div className="flex items-center gap-1.5 pt-1">
          {[15, 30, 45, 60].map((mins) => (
            <button
              key={mins}
              type="button"
              onClick={() => setActualDuration(String(mins))}
              className={`px-2.5 py-1 text-xs rounded-lg border transition-colors cursor-pointer ${
                actualDuration === String(mins)
                  ? 'border-[#2d553c] bg-[#2d553c] text-white font-medium'
                  : 'border-[#e2ded5] dark:border-[#383530] bg-[#ffffff] dark:bg-[#1f1e1d] text-[#6b6760] dark:text-[#9e998f] hover:border-[#b8b3a7]'
              }`}
            >
              {mins}m
            </button>
          ))}
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#e2ded5] dark:border-[#383530]">
          <Button
            type="button"
            variant="ghost"
            disabled={submitting}
            onClick={() => handleComplete(null)}
          >
            Skip Duration
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={submitting}
            onClick={() => handleComplete(actualDuration || null)}
          >
            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
            <span>Mark Done</span>
          </Button>
        </div>
      </div>
    </Modal>
  );
}
