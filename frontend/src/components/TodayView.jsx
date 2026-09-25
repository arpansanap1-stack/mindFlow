import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar,
  Clock,
  Play,
  CheckCircle2,
  Circle,
  Pause,
  ArrowRight,
  SkipForward,
  ChevronRight,
  Lock,
  CalendarClock,
  Coffee,
  Moon,
  Compass,
} from 'lucide-react';
import Button from './ui/Button';
import Badge from './ui/Badge';
import EmptyState from './ui/EmptyState';
import { fetchNowSuggestion, recordSuggestionAction } from '../api/suggest';
import { fetchSchedule, runScheduler } from '../api/schedule';
import { fetchRoutineBlocks } from '../api/routine';
import CaptureBar from './CaptureBar';

function ContextIconBadge({ contextType }) {
  let Icon = Compass;
  if (contextType === 'routine') Icon = Coffee;
  else if (contextType === 'off_hours') Icon = Moon;
  else if (contextType === 'scheduled_slot') Icon = CalendarClock;

  return <Icon className="w-3 h-3 text-[#2d553c] dark:text-[#5b8a6c]" />;
}

export default function TodayView({
  items,
  currentUser,
  onCompleteItem,
  onCapture,
  onToast,
  suggestionRefreshKey,
  onNavigateTab,
}) {
  const [suggestion, setSuggestion] = useState(null);
  const [isSuggestionLoading, setIsSuggestionLoading] = useState(true);
  const [isActing, setIsActing] = useState(false);

  // Today's schedule data
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [todaySlots, setTodaySlots] = useState([]);
  const [todayRoutine, setTodayRoutine] = useState([]);
  const [isScheduleLoading, setIsScheduleLoading] = useState(true);
  const [isScheduling, setIsScheduling] = useState(false);

  // Focus Timer Mode State
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [focusSecondsLeft, setFocusSecondsLeft] = useState(25 * 60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  // Load suggestion
  const loadSuggestion = useCallback(async () => {
    setIsSuggestionLoading(true);
    try {
      const data = await fetchNowSuggestion();
      setSuggestion(data);
    } catch (err) {
      console.error('Failed to load suggestion:', err);
      setSuggestion(null);
    } finally {
      setIsSuggestionLoading(false);
    }
  }, []);

  // Load Today schedule & routine
  const loadTodaySchedule = useCallback(async () => {
    setIsScheduleLoading(true);
    try {
      const d = new Date();
      const jsDay = d.getDay();
      const pythonWeekday = jsDay === 0 ? 6 : jsDay - 1;

      const [slotsData, routineData] = await Promise.all([
        fetchSchedule(todayStr),
        fetchRoutineBlocks(pythonWeekday),
      ]);
      setTodaySlots(slotsData || []);
      setTodayRoutine(routineData || []);
    } catch (err) {
      console.error('Failed to load today schedule:', err);
    } finally {
      setIsScheduleLoading(false);
    }
  }, [todayStr]);

  useEffect(() => {
    loadSuggestion();
    loadTodaySchedule();
  }, [loadSuggestion, loadTodaySchedule, suggestionRefreshKey]);

  // Focus Timer countdown
  useEffect(() => {
    let interval = null;
    if (isTimerRunning && focusSecondsLeft > 0) {
      interval = setInterval(() => {
        setFocusSecondsLeft((sec) => sec - 1);
      }, 1000);
    } else if (focusSecondsLeft === 0 && isTimerRunning) {
      setIsTimerRunning(false);
      onToast?.('Focus session completed! Great job.', 'success');
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, focusSecondsLeft, onToast]);

  const handleStartFocus = (minutes = 25) => {
    setFocusSecondsLeft(minutes * 60);
    setIsTimerRunning(true);
    setIsFocusMode(true);
  };

  const handleAction = async (actionType) => {
    if (!suggestion?.item || isActing) return;
    setIsActing(true);
    try {
      await recordSuggestionAction(suggestion.item.id, actionType);

      if (actionType === 'start') {
        const estMinutes = suggestion.item.est_duration_min || 25;
        handleStartFocus(estMinutes);
        onToast?.(`Focus started for "${suggestion.item.raw_text}"`);
      } else if (actionType === 'done') {
        onCompleteItem(suggestion.item);
        setIsFocusMode(false);
        setIsTimerRunning(false);
      } else if (actionType === 'skip') {
        onToast?.('Skipped item — refreshing next best action');
        loadSuggestion();
      }
    } catch (err) {
      onToast?.(err.message || 'Action failed', 'error');
    } finally {
      setIsActing(false);
    }
  };

  const handleAutoScheduleToday = async () => {
    setIsScheduling(true);
    try {
      const result = await runScheduler(todayStr);
      setTodaySlots(result.slots || []);
      if (result.scheduled_count > 0) {
        onToast?.(`Scheduled ${result.scheduled_count} task(s) for today!`);
      } else {
        onToast?.('Schedule up to date — no pending items');
      }
    } catch (err) {
      onToast?.(err.message || 'Failed to auto-schedule', 'error');
    } finally {
      setIsScheduling(false);
    }
  };

  // Merge today's chronological timeline
  const todayTimeline = useMemo(() => {
    const combined = [];

    todayRoutine.forEach((rb) => {
      combined.push({
        type: 'routine',
        id: `rb-${rb.id}`,
        startTime: rb.start_time.slice(0, 5),
        endTime: rb.end_time.slice(0, 5),
        label: rb.label || 'Routine Block',
        fixed: rb.fixed,
      });
    });

    todaySlots.forEach((s) => {
      combined.push({
        type: 'slot',
        id: `slot-${s.id}`,
        startTime: s.start_time.slice(0, 5),
        endTime: s.end_time.slice(0, 5),
        item: s.item,
      });
    });

    combined.sort((a, b) => a.startTime.localeCompare(b.startTime));

    const result = [];
    let lastEnd = '08:00';

    combined.forEach((entry) => {
      if (entry.startTime > lastEnd) {
        const [h1, m1] = lastEnd.split(':').map(Number);
        const [h2, m2] = entry.startTime.split(':').map(Number);
        const gapMin = (h2 * 60 + m2) - (h1 * 60 + m1);

        if (gapMin >= 15) {
          result.push({
            type: 'free',
            startTime: lastEnd,
            endTime: entry.startTime,
            durationMin: gapMin,
          });
        }
      }
      result.push(entry);
      if (entry.endTime > lastEnd) {
        lastEnd = entry.endTime;
      }
    });

    return result;
  }, [todayRoutine, todaySlots]);

  // Upcoming items (due soon or high priority)
  const upcomingItems = useMemo(() => {
    return items
      .filter((it) => it.status !== 'done')
      .slice(0, 4);
  }, [items]);

  // Greeting & Date formatting
  const todayFormatted = useMemo(() => {
    return new Date().toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
  }, []);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const completedCount = useMemo(() => {
    return items.filter((i) => i.status === 'done').length;
  }, [items]);

  const activeCount = useMemo(() => {
    return items.filter((i) => i.status !== 'done').length;
  }, [items]);

  const formatTimer = (totalSeconds) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-150">
      {/* Top Section: Date, Greeting & Progress Summary */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 border-b border-[#e2ded5] dark:border-[#383530] pb-4">
        <div>
          <span className="text-xs uppercase tracking-wider font-medium text-[#6b6760] dark:text-[#9e998f]">
            {todayFormatted}
          </span>
          <h2 className="text-xl sm:text-2xl font-semibold text-[#1f1e1d] dark:text-[#ebe8e2] tracking-tight mt-0.5">
            {greeting}
            {currentUser?.email ? `, ${currentUser.email.split('@')[0]}` : ''}
          </h2>
        </div>

        {/* Small Progress Summary */}
        <div className="flex items-center gap-2 text-xs text-[#6b6760] dark:text-[#9e998f] self-start sm:self-auto">
          <span>{completedCount} completed</span>
          <span>·</span>
          <span>{activeCount} active</span>
        </div>
      </div>

      {/* Focus Timer Mode Overlay Banner (if active) */}
      {isFocusMode && suggestion?.item && (
        <div className="p-4 sm:p-5 rounded-2xl bg-[#edf3ee] dark:bg-[#1e2e23] border border-[#a4c0ad] dark:border-[#35523f] flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="w-10 h-10 rounded-xl bg-[#2d553c] text-white flex items-center justify-center font-mono font-semibold text-sm shrink-0">
              {formatTimer(focusSecondsLeft)}
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#20402d] dark:text-[#c2d9cb]">
                Focus Session in Progress
              </span>
              <p className="text-sm font-semibold text-[#1f1e1d] dark:text-[#ebe8e2] truncate">
                {suggestion.item.raw_text}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsTimerRunning(!isTimerRunning)}
            >
              {isTimerRunning ? (
                <>
                  <Pause className="w-3.5 h-3.5 mr-1" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 mr-1" />
                  <span>Resume</span>
                </>
              )}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleAction('done')}
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
              <span>Complete Task</span>
            </Button>
          </div>
        </div>
      )}

      {/* Primary Area: "What should you focus on?" (One Best Action) */}
      <section aria-label="Next Up Focus Action" className="space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold text-[#6b6760] dark:text-[#9e998f] uppercase tracking-wider px-1">
          <span>What to focus on right now</span>
          {suggestion?.context_type && (
            <span className="flex items-center gap-1 normal-case font-normal text-[#6b6760] dark:text-[#9e998f]">
              <ContextIconBadge contextType={suggestion.context_type} />
              <span className="capitalize">{suggestion.context_type.replace('_', ' ')}</span>
            </span>
          )}
        </div>

        {isSuggestionLoading ? (
          <div className="p-6 rounded-2xl border border-[#e2ded5] dark:border-[#383530] bg-[#ffffff] dark:bg-[#1f1e1d] space-y-3">
            <div className="h-4 w-28 bg-[#f4f2ee] dark:bg-[#282623] rounded animate-pulse" />
            <div className="h-6 w-3/4 bg-[#f4f2ee] dark:bg-[#282623] rounded animate-pulse" />
            <div className="h-4 w-1/2 bg-[#f4f2ee] dark:bg-[#282623] rounded animate-pulse" />
          </div>
        ) : suggestion?.item ? (
          <div className="p-5 sm:p-6 rounded-2xl border border-[#e2ded5] dark:border-[#383530] bg-[#ffffff] dark:bg-[#1f1e1d] shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold tracking-wide uppercase px-2 py-0.5 rounded bg-[#edf3ee] dark:bg-[#1e2e23] text-[#20402d] dark:text-[#c2d9cb] border border-[#a4c0ad] dark:border-[#35523f]">
                    Next Up
                  </span>
                  {suggestion.item.category && (
                    <Badge variant={suggestion.item.category}>
                      {suggestion.item.category}
                    </Badge>
                  )}
                  {suggestion.item.priority && (
                    <Badge variant={suggestion.item.priority >= 4 ? 'priority-high' : 'priority-mid'}>
                      P{suggestion.item.priority}
                    </Badge>
                  )}
                </div>

                <h3 className="text-base sm:text-lg font-semibold text-[#1f1e1d] dark:text-[#ebe8e2] break-words leading-snug">
                  {suggestion.item.raw_text}
                </h3>

                <div className="flex flex-wrap items-center gap-3 text-xs text-[#6b6760] dark:text-[#9e998f] pt-1">
                  {suggestion.item.est_duration_min && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{suggestion.item.est_duration_min} min</span>
                    </span>
                  )}
                  {suggestion.item.deadline && (
                    <span className="flex items-center gap-1 text-[#7d3b2b] dark:text-[#d48372]">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>
                        Due {new Date(suggestion.item.deadline).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </span>
                    </span>
                  )}
                  {suggestion.explanation && (
                    <span className="text-[11px] text-[#6b6760] dark:text-[#9e998f] italic">
                      "{suggestion.explanation}"
                    </span>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 pt-2 sm:pt-0 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAction('skip')}
                  disabled={isActing}
                  title="Show another recommended task"
                >
                  <SkipForward className="w-3.5 h-3.5 mr-1" />
                  <span>Later</span>
                </Button>

                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleAction('start')}
                  disabled={isActing}
                >
                  <Play className="w-3.5 h-3.5 mr-1 fill-current" />
                  <span>Start Focus</span>
                </Button>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleAction('done')}
                  disabled={isActing}
                  title="Mark done"
                >
                  <CheckCircle2 className="w-4 h-4 text-[#2d553c]" />
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <EmptyState
            title="All clear for right now"
            description="You have no pending tasks needing immediate focus. Capture a new thought below or relax."
          />
        )}
      </section>

      {/* Quick Capture Inline Section */}
      <section aria-label="Quick Thought Dump" className="pt-2">
        <CaptureBar onCapture={onCapture} />
      </section>

      {/* Secondary Section: Today's Plan & Timeline */}
      <section aria-label="Today's Plan" className="space-y-3">
        <div className="flex items-center justify-between text-xs font-semibold text-[#6b6760] dark:text-[#9e998f] uppercase tracking-wider px-1">
          <span>Today's Plan</span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleAutoScheduleToday}
              disabled={isScheduling}
              className="text-[#2d553c] dark:text-[#5b8a6c] font-medium hover:underline cursor-pointer disabled:opacity-50"
            >
              {isScheduling ? 'Scheduling...' : 'Auto-Fit Inbox'}
            </button>
            <span>·</span>
            <button
              onClick={() => onNavigateTab?.('schedule')}
              className="text-[#6b6760] hover:text-[#1f1e1d] dark:text-[#9e998f] dark:hover:text-[#ebe8e2] font-medium flex items-center cursor-pointer"
            >
              <span>Full Schedule</span>
              <ChevronRight className="w-3 h-3 ml-0.5" />
            </button>
          </div>
        </div>

        {isScheduleLoading ? (
          <div className="p-4 rounded-xl border border-[#e2ded5] dark:border-[#383530] bg-[#ffffff] dark:bg-[#1f1e1d] text-center text-xs text-[#6b6760] py-8">
            Loading today's schedule...
          </div>
        ) : todayTimeline.length > 0 ? (
          <div className="space-y-1.5">
            {todayTimeline.slice(0, 5).map((entry) => {
              if (entry.type === 'routine') {
                return (
                  <div
                    key={entry.id}
                    className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-[#f4f2ee]/60 dark:bg-[#282623]/60 border border-[#e2ded5] dark:border-[#383530] text-xs text-[#6b6760] dark:text-[#9e998f]"
                  >
                    <span className="w-20 font-mono font-medium text-[11px] shrink-0">
                      {entry.startTime} – {entry.endTime}
                    </span>
                    <span className="p-1 rounded bg-[#e2ded5]/60 dark:bg-[#383530] text-[#6b6760] dark:text-[#9e998f]">
                      <Lock className="w-3 h-3" />
                    </span>
                    <span className="font-medium text-[#1f1e1d] dark:text-[#ebe8e2] truncate flex-1">
                      {entry.label}
                    </span>
                    <span className="text-[10px] text-[#6b6760] dark:text-[#9e998f]">
                      Routine
                    </span>
                  </div>
                );
              }

              if (entry.type === 'slot') {
                const item = entry.item;
                const isDone = item?.status === 'done';
                return (
                  <div
                    key={entry.id}
                    className={`flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border transition-colors ${
                      isDone
                        ? 'bg-[#f4f2ee]/40 border-[#e2ded5]/60 opacity-60'
                        : 'bg-[#ffffff] dark:bg-[#1f1e1d] border-[#e2ded5] dark:border-[#383530] hover:border-[#b8b3a7]'
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className="w-20 font-mono font-medium text-[11px] text-[#2d553c] dark:text-[#5b8a6c] shrink-0">
                        {entry.startTime} – {entry.endTime}
                      </span>
                      <button
                        onClick={() => item && onCompleteItem(item)}
                        className="text-[#6b6760] hover:text-[#2d553c] cursor-pointer shrink-0"
                      >
                        {isDone ? (
                          <CheckCircle2 className="w-4 h-4 text-[#2d553c]" />
                        ) : (
                          <Circle className="w-4 h-4" />
                        )}
                      </button>
                      <span
                        className={`text-xs font-medium truncate flex-1 ${
                          isDone ? 'line-through text-[#6b6760]' : 'text-[#1f1e1d] dark:text-[#ebe8e2]'
                        }`}
                      >
                        {item ? item.raw_text : 'Scheduled task'}
                      </span>
                    </div>
                  </div>
                );
              }

              if (entry.type === 'free') {
                return (
                  <div
                    key={entry.startTime}
                    className="flex items-center gap-3 px-3.5 py-1.5 rounded-lg border border-dashed border-[#e2ded5] dark:border-[#383530] text-[11px] text-[#9e998f]"
                  >
                    <span className="w-20 font-mono text-[11px] shrink-0">
                      {entry.startTime} – {entry.endTime}
                    </span>
                    <span className="text-[#6b6760] dark:text-[#9e998f]">
                      Open focus slot ({entry.durationMin}m free)
                    </span>
                  </div>
                );
              }

              return null;
            })}
          </div>
        ) : (
          <div className="p-4 rounded-xl border border-dashed border-[#e2ded5] dark:border-[#383530] bg-[#ffffff] dark:bg-[#1f1e1d] text-center text-xs text-[#6b6760] py-6 flex items-center justify-between">
            <span>No schedule slots planned for today yet.</span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAutoScheduleToday}
              disabled={isScheduling}
            >
              Auto-Schedule Today
            </Button>
          </div>
        )}
      </section>

      {/* Tertiary Section: Upcoming Deadlines */}
      <section aria-label="Upcoming" className="space-y-3">
        <div className="flex items-center justify-between text-xs font-semibold text-[#6b6760] dark:text-[#9e998f] uppercase tracking-wider px-1">
          <span>Upcoming In Workspace</span>
          <button
            onClick={() => onNavigateTab?.('inbox')}
            className="text-[#6b6760] hover:text-[#1f1e1d] dark:text-[#9e998f] dark:hover:text-[#ebe8e2] font-medium flex items-center cursor-pointer"
          >
            <span>View Inbox</span>
            <ArrowRight className="w-3 h-3 ml-0.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {upcomingItems.map((item) => (
            <div
              key={item.id}
              className="p-3.5 rounded-xl border border-[#e2ded5] dark:border-[#383530] bg-[#ffffff] dark:bg-[#1f1e1d] flex items-start justify-between gap-2.5 hover:border-[#b8b3a7] transition-colors"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-xs font-medium text-[#1f1e1d] dark:text-[#ebe8e2] truncate">
                  {item.raw_text}
                </p>
                <div className="flex items-center gap-1.5 text-[11px] text-[#6b6760] dark:text-[#9e998f]">
                  {item.category && (
                    <Badge variant={item.category} size="xs">
                      {item.category}
                    </Badge>
                  )}
                  {item.deadline && (
                    <span className="text-[#7d3b2b] dark:text-[#d48372]">
                      Due {new Date(item.deadline).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </div>
              </div>

              <button
                onClick={() => onCompleteItem(item)}
                className="text-[#6b6760] hover:text-[#2d553c] p-1 cursor-pointer"
                title="Mark done"
              >
                <Circle className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
