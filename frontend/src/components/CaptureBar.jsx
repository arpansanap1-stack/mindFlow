import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowRight,
  Loader2,
  Mic,
  MicOff,
  AlertCircle,
  X,
  SlidersHorizontal,
  PenTool,
} from 'lucide-react';
import useSpeechRecognition from '../hooks/useSpeechRecognition';

export default function CaptureBar({ onCapture, isLoading }) {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [quickDuration, setQuickDuration] = useState('');
  const [quickDeadline, setQuickDeadline] = useState('');
  const inputRef = useRef(null);

  const {
    isSupported,
    isListening,
    error: voiceError,
    startListening,
    stopListening,
    clearError,
  } = useSpeechRecognition();

  // Focus input automatically on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    let trimmed = text.trim();
    if (!trimmed || submitting || isLoading) return;

    // Append quick duration / deadline if user clicked quick pills
    if (quickDuration && !trimmed.includes(quickDuration)) {
      trimmed += ` ~${quickDuration}`;
    }
    if (quickDeadline && !trimmed.toLowerCase().includes(quickDeadline.toLowerCase())) {
      trimmed += ` due ${quickDeadline}`;
    }

    // Stop listening if active before submitting
    if (isListening) stopListening();

    try {
      setSubmitting(true);
      await onCapture(trimmed);
      setText('');
      setQuickDuration('');
      setQuickDeadline('');
      setShowAdvanced(false);
      // Keep focus for subsequent fast captures
      inputRef.current?.focus();
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e) => {
    // IME composition safety check per modern web guidance
    if (e.key === 'Enter' && !e.shiftKey) {
      if (e.isComposing || e.keyCode === 229) {
        return;
      }
      e.preventDefault();
      handleSubmit();
    }
  };

  const toggleVoice = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening(setText);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-2">
      <form onSubmit={handleSubmit} className="relative group">
        <label htmlFor="capture-input" className="sr-only">
          Quick Capture Thought or Task
        </label>
        <div className="flex items-center bg-[#ffffff] dark:bg-[#1f1e1d] border border-[#e2ded5] dark:border-[#383530] rounded-xl shadow-xs group-focus-within:border-[#2d553c] dark:group-focus-within:border-[#5b8a6c] transition-all p-1.5 md:p-2">
          <div className="pl-3 pr-2 text-[#6b6760] dark:text-[#9e998f]">
            <PenTool className="w-4 h-4 text-[#2d553c] dark:text-[#5b8a6c]" />
          </div>

          <input
            id="capture-input"
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={submitting}
            placeholder={
              isListening
                ? 'Listening… speak your task or thought'
                : 'Add a task, idea, reminder, or thought...'
            }
            className="w-full py-2 px-1 bg-transparent text-[#1f1e1d] dark:text-[#ebe8e2] placeholder-[#9e998f] dark:placeholder-[#6b6760] text-sm md:text-base focus:outline-none"
            autoComplete="off"
          />

          {/* Voice Input Button */}
          {isSupported && (
            <button
              type="button"
              onClick={toggleVoice}
              disabled={submitting}
              className={`relative inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors cursor-pointer shrink-0 ${
                isListening
                  ? 'bg-[#7d3b2b]/10 text-[#7d3b2b] dark:text-[#d48372]'
                  : 'text-[#6b6760] dark:text-[#9e998f] hover:text-[#1f1e1d] dark:hover:text-[#ebe8e2] hover:bg-[#f4f2ee] dark:hover:bg-[#282623]'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
              aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
              title={isListening ? 'Stop listening' : 'Voice input'}
            >
              {isListening ? (
                <>
                  <MicOff className="w-4 h-4" />
                  <span className="absolute inset-0 rounded-lg border border-[#7d3b2b] animate-ping opacity-40" />
                </>
              ) : (
                <Mic className="w-4 h-4" />
              )}
            </button>
          )}

          {/* More options toggle */}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={`p-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer shrink-0 ${
              showAdvanced
                ? 'bg-[#f4f2ee] dark:bg-[#282623] text-[#2d553c] dark:text-[#5b8a6c]'
                : 'text-[#6b6760] dark:text-[#9e998f] hover:text-[#1f1e1d] dark:hover:text-[#ebe8e2]'
            }`}
            title="More capture options"
            aria-label="More options"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!text.trim() || submitting}
            className="ml-1.5 inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-[#2d553c] hover:bg-[#23432f] active:bg-[#1a3223] text-white font-medium text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0 shadow-xs"
            aria-label="Add item"
          >
            {submitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <>
                <span>Add</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>

        {/* Progressive Disclosure: Quick shortcuts */}
        {showAdvanced && (
          <div className="mt-2 p-3 rounded-lg bg-[#f4f2ee] dark:bg-[#282623] border border-[#e2ded5] dark:border-[#383530] text-xs space-y-2 animate-in fade-in duration-150">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-medium text-[#6b6760] dark:text-[#9e998f]">
                Quick duration presets:
              </span>
              <div className="flex items-center gap-1.5">
                {['15m', '30m', '45m', '60m', '90m'].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setQuickDuration(quickDuration === d ? '' : d)}
                    className={`px-2 py-0.5 rounded text-[11px] border transition-colors cursor-pointer ${
                      quickDuration === d
                        ? 'border-[#2d553c] bg-[#2d553c] text-white'
                        : 'border-[#e2ded5] dark:border-[#383530] bg-white dark:bg-[#1f1e1d] text-[#6b6760] dark:text-[#9e998f] hover:border-[#b8b3a7]'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[#e2ded5]/60 dark:border-[#383530]/60">
              <span className="text-[11px] font-medium text-[#6b6760] dark:text-[#9e998f]">
                Quick deadline presets:
              </span>
              <div className="flex items-center gap-1.5">
                {['today', 'tomorrow', 'friday', 'next week'].map((dl) => (
                  <button
                    key={dl}
                    type="button"
                    onClick={() => setQuickDeadline(quickDeadline === dl ? '' : dl)}
                    className={`px-2 py-0.5 rounded text-[11px] capitalize border transition-colors cursor-pointer ${
                      quickDeadline === dl
                        ? 'border-[#2d553c] bg-[#2d553c] text-white'
                        : 'border-[#e2ded5] dark:border-[#383530] bg-white dark:bg-[#1f1e1d] text-[#6b6760] dark:text-[#9e998f] hover:border-[#b8b3a7]'
                    }`}
                  >
                    {dl}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-between items-center px-2 pt-1.5 text-[11px] text-[#6b6760] dark:text-[#9e998f]">
          <span>
            Press <kbd className="px-1 py-0.2 rounded bg-[#f4f2ee] dark:bg-[#282623] border border-[#e2ded5] dark:border-[#383530] font-mono text-[10px]">Enter ↵</kbd> to add. MindFlow infers duration & due date.
          </span>
          <span>{isListening ? 'Listening…' : ''}</span>
        </div>
      </form>

      {/* Voice Error Banner */}
      {voiceError && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-[#7d3b2b]/10 border border-[#7d3b2b]/20 text-[#7d3b2b] dark:text-[#d48372] text-xs">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span className="flex-1">{voiceError}</span>
          <button
            type="button"
            onClick={clearError}
            className="opacity-60 hover:opacity-100 cursor-pointer p-0.5"
            aria-label="Dismiss voice error"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
