import React, { useState, useRef, useEffect } from 'react';
import { ArrowRight, Sparkles, Loader2, Mic, MicOff, AlertCircle, X } from 'lucide-react';
import useSpeechRecognition from '../hooks/useSpeechRecognition';

export default function CaptureBar({ onCapture, isLoading }) {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
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
    const trimmed = text.trim();
    if (!trimmed || submitting || isLoading) return;

    // Stop listening if active before submitting
    if (isListening) stopListening();

    try {
      setSubmitting(true);
      await onCapture(trimmed);
      setText('');
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
    <div className="w-full max-w-3xl mx-auto">
      <form onSubmit={handleSubmit} className="relative group">
        <label htmlFor="capture-input" className="sr-only">
          Quick Capture
        </label>
        <div className="flex items-center bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm group-focus-within:border-indigo-500 dark:group-focus-within:border-indigo-400 group-focus-within:shadow-md transition-all duration-200 p-1.5 md:p-2">
          <div className="pl-3 pr-2 text-slate-400 dark:text-slate-500">
            <Sparkles className="w-5 h-5 text-indigo-500 dark:text-indigo-400 animate-pulse" />
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
                ? 'Listening… speak now'
                : "Capture anything... (e.g. 'Read docs', 'Submit report by Friday 5pm')"
            }
            className="w-full py-2 px-1 bg-transparent text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-base md:text-lg focus:outline-none"
            autoComplete="off"
          />

          {/* Voice Input Button */}
          {isSupported && (
            <button
              type="button"
              onClick={toggleVoice}
              disabled={submitting}
              className={`relative ml-1 inline-flex items-center justify-center w-10 h-10 rounded-xl transition-all cursor-pointer shrink-0 ${
                isListening
                  ? 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/60'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-indigo-600 dark:hover:text-indigo-400'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
              aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
              title={isListening ? 'Stop listening' : 'Voice input'}
            >
              {isListening ? (
                <>
                  <MicOff className="w-4.5 h-4.5" />
                  {/* Pulse ring animation */}
                  <span className="absolute inset-0 rounded-xl border-2 border-red-400 dark:border-red-500 animate-ping opacity-40" />
                </>
              ) : (
                <Mic className="w-4.5 h-4.5" />
              )}
            </button>
          )}

          <button
            type="submit"
            disabled={!text.trim() || submitting}
            className="ml-2 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-medium text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0 shadow-sm"
            aria-label="Capture item"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>Capture</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>

        <div className="flex justify-between items-center px-3 pt-2 text-xs text-slate-400 dark:text-slate-500">
          <span>Zero friction — type anything and press <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-[11px] text-slate-600 dark:text-slate-300">Enter ↵</kbd></span>
          <span>{isListening ? '🎙️ Listening…' : 'No required fields'}</span>
        </div>
      </form>

      {/* Voice Error Banner */}
      {voiceError && (
        <div className="mt-2 flex items-start gap-2 px-4 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
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
