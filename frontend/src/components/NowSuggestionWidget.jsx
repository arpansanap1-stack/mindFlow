import React, { useState, useEffect, useCallback } from 'react';
import {
  Zap,
  Clock,
  Coffee,
  Compass,
  Moon,
  CheckCircle2,
  Play,
  Check,
  SkipForward,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Flame,
  CalendarClock,
} from 'lucide-react';
import { fetchNowSuggestion, recordSuggestionAction } from '../api/suggest';

export default function NowSuggestionWidget({
  onCompleteItem,
  onToast,
  refreshTrigger,
}) {
  const [suggestion, setSuggestion] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActing, setIsActing] = useState(false);
  const [isFocusing, setIsFocusing] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const loadSuggestion = useCallback(async (quiet = false) => {
    if (!quiet) setIsLoading(true);
    try {
      const data = await fetchNowSuggestion();
      setSuggestion(data);
    } catch (err) {
      console.error('Failed to load now suggestion:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSuggestion();
    // Auto-refresh every 60 seconds so context transitions accurately
    const interval = setInterval(() => loadSuggestion(true), 60000);
    return () => clearInterval(interval);
  }, [loadSuggestion, refreshTrigger]);

  const handleAccept = async () => {
    if (!suggestion?.item) return;
    setIsActing(true);
    try {
      await recordSuggestionAction(suggestion.item.id, 'accept');
      setIsFocusing(true);
      onToast?.(
        `Focus started on: "${suggestion.item.raw_text}" (Suggestion accepted)`,
        'success'
      );
    } catch (err) {
      onToast?.(err.message || 'Failed to accept suggestion', 'error');
    } finally {
      setIsActing(false);
    }
  };

  const handleDismiss = async () => {
    if (!suggestion?.item) return;
    setIsActing(true);
    try {
      await recordSuggestionAction(suggestion.item.id, 'dismiss');
      onToast?.('Suggestion dismissed. Looking for next item...', 'info');
      await loadSuggestion();
    } catch (err) {
      onToast?.(err.message || 'Failed to dismiss suggestion', 'error');
    } finally {
      setIsActing(false);
    }
  };

  const handleComplete = () => {
    if (!suggestion?.item) return;
    onCompleteItem?.(suggestion.item);
  };

  if (isLoading && !suggestion) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs animate-pulse flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-slate-800" />
          <div className="space-y-1.5">
            <div className="w-32 h-3.5 bg-slate-200 dark:bg-slate-800 rounded" />
            <div className="w-48 h-2.5 bg-slate-200 dark:bg-slate-800 rounded" />
          </div>
        </div>
        <div className="w-20 h-6 bg-slate-200 dark:bg-slate-800 rounded-lg" />
      </div>
    );
  }

  if (!suggestion) return null;

  const {
    context_type,
    reason,
    item,
    slot,
    routine_block,
    free_minutes_remaining,
    effective_duration_min,
  } = suggestion;

  // Visual theming based on current temporal context
  const getTheme = () => {
    switch (context_type) {
      case 'deep_work':
        return {
          wrapper: 'bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-transparent border-purple-200 dark:border-purple-900/60',
          badgeBg: 'bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
          iconColor: 'text-purple-600 dark:text-purple-400',
          title: 'Deep Work Window',
          icon: Zap,
        };
      case 'scheduled_slot':
        return {
          wrapper: 'bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-transparent border-blue-200 dark:border-blue-900/60',
          badgeBg: 'bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
          iconColor: 'text-blue-600 dark:text-blue-400',
          title: 'Scheduled Slot Active',
          icon: CalendarClock,
        };
      case 'routine':
        return {
          wrapper: 'bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-transparent border-amber-200 dark:border-amber-900/60',
          badgeBg: 'bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
          iconColor: 'text-amber-600 dark:text-amber-400',
          title: 'Routine Commitment',
          icon: Coffee,
        };
      case 'off_hours':
        return {
          wrapper: 'bg-gradient-to-r from-slate-500/10 via-slate-400/5 to-transparent border-slate-200 dark:border-slate-800',
          badgeBg: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
          iconColor: 'text-slate-500 dark:text-slate-400',
          title: 'Off Hours',
          icon: Moon,
        };
      case 'clear':
        return {
          wrapper: 'bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-transparent border-emerald-200 dark:border-emerald-900/60',
          badgeBg: 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
          iconColor: 'text-emerald-600 dark:text-emerald-400',
          title: 'All Clear',
          icon: CheckCircle2,
        };
      case 'free_gap':
      default:
        return {
          wrapper: 'bg-gradient-to-r from-indigo-500/10 via-sky-500/10 to-transparent border-indigo-200 dark:border-indigo-900/60',
          badgeBg: 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
          iconColor: 'text-indigo-600 dark:text-indigo-400',
          title: 'Free Time Gap',
          icon: Compass,
        };
    }
  };

  const theme = getTheme();
  const IconComponent = theme.icon;

  return (
    <aside
      aria-label="What should I do now?"
      className={`border rounded-2xl p-4 shadow-sm transition-all duration-200 bg-white dark:bg-slate-900 ${theme.wrapper}`}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700/60 shadow-2xs">
            <IconComponent className={`w-4 h-4 ${theme.iconColor}`} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                What should I do now?
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${theme.badgeBg}`}
              >
                {theme.title}
              </span>
              {free_minutes_remaining !== null && free_minutes_remaining !== undefined && (
                <span className="inline-flex items-center gap-1 text-[11px] font-mono font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded-md">
                  <Clock className="w-3 h-3 text-slate-400" />
                  {free_minutes_remaining}m window
                </span>
              )}
            </div>
            {!isCollapsed && (
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 truncate">
                {reason}
              </p>
            )}
          </div>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => loadSuggestion()}
            disabled={isLoading}
            title="Refresh suggestion"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? 'Expand widget' : 'Collapse widget'}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            {isCollapsed ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronUp className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Expanded body with Item or Routine Context */}
      {!isCollapsed && (
        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80">
          {item ? (
            <div className="bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 rounded-xl p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  {item.category && (
                    <span className="px-2 py-0.5 rounded-md font-semibold text-[10px] uppercase tracking-wide bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                      {item.category}
                    </span>
                  )}
                  {item.priority && (
                    <span className="font-semibold text-[11px] text-amber-600 dark:text-amber-400">
                      P{item.priority}
                    </span>
                  )}
                  {item.topic_tag && (
                    <span className="text-[11px] text-slate-500 font-medium">
                      #{item.topic_tag}
                    </span>
                  )}
                  <span className="text-[11px] font-mono text-slate-500">
                    est: {effective_duration_min || item.est_duration_min || 30}m
                  </span>
                  {isFocusing && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md animate-pulse">
                      <Flame className="w-3 h-3" /> Focus Session Active
                    </span>
                  )}
                </div>

                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {item.raw_text}
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 shrink-0">
                {!isFocusing ? (
                  <button
                    onClick={handleAccept}
                    disabled={isActing}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Focus Now</span>
                  </button>
                ) : (
                  <button
                    onClick={handleComplete}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Done</span>
                  </button>
                )}

                {!isFocusing && (
                  <button
                    onClick={handleDismiss}
                    disabled={isActing}
                    title="Skip to next candidate item"
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <SkipForward className="w-3.5 h-3.5" />
                    <span>Skip</span>
                  </button>
                )}
              </div>
            </div>
          ) : routine_block ? (
            <div className="text-xs text-slate-600 dark:text-slate-400 flex items-center justify-between">
              <div>
                Commitment: <strong className="text-slate-900 dark:text-slate-100">{routine_block.label || 'Routine'}</strong> ({routine_block.start_time} - {routine_block.end_time})
              </div>
              <span className="text-[11px] text-slate-400">Fixed block protected from auto-scheduler</span>
            </div>
          ) : (
            <div className="text-xs text-slate-500 dark:text-slate-400">
              No immediate items require your attention right now. You can capture a quick thought below!
            </div>
          )}
        </div>
      )}
    </aside>
  );
}

