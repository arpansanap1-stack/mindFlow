import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Plus,
  Minimize2,
  Maximize2,
  X,
  Volume2,
  CheckCircle,
  Timer as TimerIcon,
  Flame,
  Clock,
} from 'lucide-react';

/**
 * Plays an audio chime using Web Audio API (100% offline, zero audio file dependency).
 */
function playCompletionChime() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6 arpeggio
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.12);

      gain.gain.setValueAtTime(0, ctx.currentTime + idx * 0.12);
      gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + idx * 0.12 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.12 + 0.6);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + idx * 0.12);
      osc.stop(ctx.currentTime + idx * 0.12 + 0.7);
    });
  } catch {
    // Audio context may fail if user hasn't interacted yet
  }
}

export default function FocusTimer({
  isOpen,
  onClose,
  activeTask,
  onCompleteTask,
  onClearTask,
}) {
  const [mode, setMode] = useState('countdown'); // 'countdown' | 'stopwatch'
  const [totalSeconds, setTotalSeconds] = useState(25 * 60); // Default Pomodoro 25 min
  const [secondsRemaining, setSecondsRemaining] = useState(25 * 60);
  const [stopwatchSeconds, setStopwatchSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  // Sync active task duration to timer when a task is selected
  useEffect(() => {
    if (activeTask && activeTask.est_duration_min) {
      const secs = activeTask.est_duration_min * 60;
      setTotalSeconds(secs);
      setSecondsRemaining(secs);
      setIsRunning(false);
      setIsCompleted(false);
    }
  }, [activeTask]);

  // Main tick interval
  useEffect(() => {
    let interval = null;
    if (isRunning) {
      interval = setInterval(() => {
        if (mode === 'countdown') {
          setSecondsRemaining((prev) => {
            if (prev <= 1) {
              clearInterval(interval);
              setIsRunning(false);
              setIsCompleted(true);
              playCompletionChime();
              return 0;
            }
            return prev - 1;
          });
        } else {
          setStopwatchSeconds((prev) => prev + 1);
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, mode]);

  // Sync timer countdown to browser tab title
  useEffect(() => {
    const originalTitle = 'MindFlow';
    if (isRunning) {
      const currentSecs = mode === 'countdown' ? secondsRemaining : stopwatchSeconds;
      const m = Math.floor(currentSecs / 60);
      const s = currentSecs % 60;
      const timeStr = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      const taskLabel = activeTask ? ` - ${activeTask.raw_text.slice(0, 20)}...` : '';
      document.title = `(${timeStr}) Focus${taskLabel} | MindFlow`;
    } else {
      document.title = originalTitle;
    }
    return () => {
      document.title = originalTitle;
    };
  }, [isRunning, secondsRemaining, stopwatchSeconds, mode, activeTask]);

  const handleStartPause = () => {
    if (isCompleted) {
      // If completed and clicking start, reset first
      setSecondsRemaining(totalSeconds);
      setIsCompleted(false);
    }
    setIsRunning(!isRunning);
  };

  const handleReset = () => {
    setIsRunning(false);
    setIsCompleted(false);
    if (mode === 'countdown') {
      setSecondsRemaining(totalSeconds);
    } else {
      setStopwatchSeconds(0);
    }
  };

  const handleSelectPreset = (mins) => {
    const secs = mins * 60;
    setTotalSeconds(secs);
    setSecondsRemaining(secs);
    setIsRunning(false);
    setIsCompleted(false);
  };

  const handleAddFiveMinutes = () => {
    if (mode === 'countdown') {
      setTotalSeconds((prev) => prev + 300);
      setSecondsRemaining((prev) => prev + 300);
    }
  };

  const handleFinishAndLog = () => {
    if (activeTask && onCompleteTask) {
      // Calculate tracked minutes
      let minutesLogged = 0;
      if (mode === 'countdown') {
        const elapsed = Math.max(1, totalSeconds - secondsRemaining);
        minutesLogged = Math.ceil(elapsed / 60);
      } else {
        minutesLogged = Math.max(1, Math.ceil(stopwatchSeconds / 60));
      }

      onCompleteTask(activeTask.id, { actual_duration: minutesLogged });
      setIsRunning(false);
      if (onClearTask) onClearTask();
    }
  };

  if (!isOpen) return null;

  // Format MM:SS display
  const displaySeconds = mode === 'countdown' ? secondsRemaining : stopwatchSeconds;
  const minutes = Math.floor(displaySeconds / 60);
  const seconds = displaySeconds % 60;
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const progressPercent =
    mode === 'countdown' && totalSeconds > 0
      ? Math.min(100, Math.max(0, ((totalSeconds - secondsRemaining) / totalSeconds) * 100))
      : 100;

  // Floating Minimized Pill
  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-slate-900 border border-indigo-500/50 rounded-full px-4 py-2.5 shadow-2xl shadow-indigo-950/80 backdrop-blur-md animate-fade-in">
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            {isRunning && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
            )}
            <span
              className={`relative inline-flex rounded-full h-3 w-3 ${
                isRunning ? 'bg-indigo-500' : 'bg-slate-500'
              }`}
            ></span>
          </span>
          <span className="font-mono text-base font-bold text-white tracking-wider">
            {timeFormatted}
          </span>
        </div>

        {activeTask && (
          <span className="text-xs text-slate-300 font-medium max-w-[140px] truncate border-l border-slate-700 pl-2">
            {activeTask.raw_text}
          </span>
        )}

        <div className="flex items-center gap-1 border-l border-slate-700 pl-2">
          <button
            onClick={handleStartPause}
            className="p-1 rounded-full text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            title={isRunning ? 'Pause' : 'Start'}
          >
            {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setIsMinimized(false)}
            className="p-1 rounded-full text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            title="Expand"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // Full Modal Focus Dialog
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl shadow-indigo-950/40 text-slate-100 flex flex-col items-center">
        {/* Top Bar Controls */}
        <div className="w-full flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-indigo-400 font-semibold text-sm">
            <TimerIcon className="w-4 h-4" />
            <span>Focus Mode</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsMinimized(true)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
              title="Minimize to floating pill"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mode Selector */}
        <div className="flex bg-slate-800/80 p-1 rounded-xl mb-6 border border-slate-700/60">
          <button
            type="button"
            onClick={() => {
              setMode('countdown');
              setIsRunning(false);
            }}
            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
              mode === 'countdown'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Countdown (Pomodoro)
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('stopwatch');
              setIsRunning(false);
            }}
            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
              mode === 'stopwatch'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Stopwatch
          </button>
        </div>

        {/* Active Task Banner */}
        {activeTask ? (
          <div className="w-full bg-slate-800/50 border border-indigo-500/30 rounded-2xl p-3 mb-6 flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">
                Currently Focusing On
              </span>
              <p className="text-sm font-medium text-slate-200 truncate">{activeTask.raw_text}</p>
            </div>
            {onClearTask && (
              <button
                onClick={onClearTask}
                className="text-xs text-slate-400 hover:text-slate-200 p-1"
                title="Detach Task"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ) : (
          <div className="w-full text-center mb-6">
            <p className="text-xs text-slate-400">
              Select any task from your Inbox or Day Plan to link it directly.
            </p>
          </div>
        )}

        {/* Big Time Display & Visual Ring */}
        <div className="relative flex flex-col items-center justify-center my-2">
          {/* Progress bar container */}
          <div className="w-64 h-3 bg-slate-800 rounded-full overflow-hidden mb-6 border border-slate-700/50">
            <div
              className={`h-full transition-all duration-1000 ${
                isCompleted
                  ? 'bg-emerald-500'
                  : isRunning
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-500'
                  : 'bg-indigo-600'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div
            className={`font-mono text-6xl font-black tracking-tight select-none ${
              isCompleted ? 'text-emerald-400 animate-pulse' : 'text-white'
            }`}
          >
            {timeFormatted}
          </div>

          {isCompleted && (
            <div className="mt-3 flex items-center gap-1.5 text-emerald-400 text-sm font-semibold">
              <Volume2 className="w-4 h-4 animate-bounce" />
              <span>Session Completed! Great job!</span>
            </div>
          )}
        </div>

        {/* Presets (Only in countdown mode) */}
        {mode === 'countdown' && (
          <div className="flex flex-wrap items-center justify-center gap-2 my-5">
            {[15, 25, 45, 60].map((mins) => (
              <button
                key={mins}
                onClick={() => handleSelectPreset(mins)}
                disabled={isRunning}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                  totalSeconds === mins * 60
                    ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300'
                    : 'border-slate-700 bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:border-slate-600'
                } ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {mins}m
              </button>
            ))}
            <button
              onClick={handleAddFiveMinutes}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-700 bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700 transition-all"
              title="Add 5 minutes"
            >
              <Plus className="w-3 h-3" /> 5m
            </button>
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center gap-4 mt-2">
          <button
            onClick={handleReset}
            className="p-3 rounded-2xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors shadow"
            title="Reset"
          >
            <RotateCcw className="w-5 h-5" />
          </button>

          <button
            onClick={handleStartPause}
            className={`px-8 py-3.5 rounded-2xl font-bold text-base flex items-center gap-2 shadow-lg transition-all transform active:scale-95 ${
              isRunning
                ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-950/40'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-950/50'
            }`}
          >
            {isRunning ? (
              <>
                <Pause className="w-5 h-5" /> Pause
              </>
            ) : (
              <>
                <Play className="w-5 h-5" /> {isCompleted ? 'Restart' : 'Start Focus'}
              </>
            )}
          </button>
        </div>

        {/* Complete Task & Feedback action */}
        {activeTask && (
          <div className="w-full mt-6 pt-4 border-t border-slate-800 flex flex-col gap-2">
            <button
              onClick={handleFinishAndLog}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded-xl text-sm font-semibold transition-colors"
            >
              <CheckCircle className="w-4 h-4" />
              Complete Task & Log Duration
            </button>
            <span className="text-[11px] text-slate-500 text-center">
              Logs tracked time to personal duration multiplier feedback loop
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
