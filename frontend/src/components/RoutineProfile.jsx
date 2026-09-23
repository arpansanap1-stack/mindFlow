import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  Plus,
  Trash2,
  Edit3,
  Sliders,
  CheckCircle2,
  Lock,
  Sparkles,
  Save,
  X,
  RefreshCw,
  TrendingUp,
  Brain,
} from 'lucide-react';
import {
  fetchRoutineBlocks,
  createRoutineBlock,
  updateRoutineBlock,
  deleteRoutineBlock,
  fetchUserPrefs,
  updateUserPrefs,
} from '../api/routine';
import {
  fetchFeedbackStats,
  recalibrateMultipliers,
} from '../api/feedback';

const DAYS = [
  { id: 0, name: 'Monday', short: 'Mon' },
  { id: 1, name: 'Tuesday', short: 'Tue' },
  { id: 2, name: 'Wednesday', short: 'Wed' },
  { id: 3, name: 'Thursday', short: 'Thu' },
  { id: 4, name: 'Friday', short: 'Fri' },
  { id: 5, name: 'Saturday', short: 'Sat' },
  { id: 6, name: 'Sunday', short: 'Sun' },
];

export default function RoutineProfile({ onToast }) {
  const [selectedDay, setSelectedDay] = useState(0); // 0 = Monday
  const [blocks, setBlocks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // New/Edit block modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState(null);
  const [dayOfWeek, setDayOfWeek] = useState(0);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [label, setLabel] = useState('');
  const [isFixed, setIsFixed] = useState(true);
  const [isSavingBlock, setIsSavingBlock] = useState(false);

  // User preferences state
  const [deepHoursInput, setDeepHoursInput] = useState('09:00-11:00');
  const [breakDuration, setBreakDuration] = useState(10);
  const [multipliers, setMultipliers] = useState({});
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);

  // Feedback & Learning state
  const [feedbackStats, setFeedbackStats] = useState(null);
  const [isRecalibrating, setIsRecalibrating] = useState(false);

  // Load routine blocks and prefs
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [blocksData, prefsData, statsData] = await Promise.all([
        fetchRoutineBlocks(),
        fetchUserPrefs(),
        fetchFeedbackStats().catch(() => null),
      ]);
      setBlocks(blocksData);
      if (prefsData) {
        setDeepHoursInput(
          (prefsData.preferred_deep_hours || ['09:00-11:00']).join(', ')
        );
        setBreakDuration(prefsData.break_duration_pref ?? 10);
        setMultipliers(prefsData.category_duration_multiplier || {});
      }
      if (statsData) {
        setFeedbackStats(statsData);
      }
    } catch (err) {
      onToast?.(err.message || 'Failed to load routine profile', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openAddModal = (presetDay = selectedDay) => {
    setEditingBlock(null);
    setDayOfWeek(presetDay);
    setStartTime('09:00');
    setEndTime('10:00');
    setLabel('');
    setIsFixed(true);
    setIsModalOpen(true);
  };

  const openEditModal = (block) => {
    setEditingBlock(block);
    setDayOfWeek(block.day_of_week);
    // Format HH:MM
    const s = block.start_time.slice(0, 5);
    const e = block.end_time.slice(0, 5);
    setStartTime(s);
    setEndTime(e);
    setLabel(block.label || '');
    setIsFixed(block.fixed);
    setIsModalOpen(true);
  };

  const handleSaveBlock = async (e) => {
    e.preventDefault();
    if (!startTime || !endTime || startTime >= endTime) {
      onToast?.('End time must be after start time', 'error');
      return;
    }

    setIsSavingBlock(true);
    try {
      const payload = {
        day_of_week: Number(dayOfWeek),
        start_time: startTime.length === 5 ? `${startTime}:00` : startTime,
        end_time: endTime.length === 5 ? `${endTime}:00` : endTime,
        label: label.trim() || null,
        fixed: isFixed,
      };

      if (editingBlock) {
        const updated = await updateRoutineBlock(editingBlock.id, payload);
        setBlocks((prev) =>
          prev.map((b) => (b.id === editingBlock.id ? updated : b))
        );
        onToast?.('Routine block updated');
      } else {
        const created = await createRoutineBlock(payload);
        setBlocks((prev) => [...prev, created]);
        onToast?.('Routine block added');
      }
      setIsModalOpen(false);
    } catch (err) {
      onToast?.(err.message || 'Failed to save block', 'error');
    } finally {
      setIsSavingBlock(false);
    }
  };

  const handleDeleteBlock = async (id) => {
    if (!window.confirm('Delete this routine block?')) return;
    try {
      await deleteRoutineBlock(id);
      setBlocks((prev) => prev.filter((b) => b.id !== id));
      onToast?.('Routine block removed');
    } catch (err) {
      onToast?.(err.message || 'Failed to delete block', 'error');
    }
  };

  const handleSavePrefs = async (e) => {
    e.preventDefault();
    setIsSavingPrefs(true);
    try {
      const hoursList = deepHoursInput
        .split(',')
        .map((h) => h.trim())
        .filter(Boolean);

      await updateUserPrefs({
        preferred_deep_hours: hoursList,
        break_duration_pref: Number(breakDuration),
      });
      onToast?.('Preferences saved successfully');
    } catch (err) {
      onToast?.(err.message || 'Failed to save preferences', 'error');
    } finally {
      setIsSavingPrefs(false);
    }
  };

  const handleRecalibrate = async () => {
    setIsRecalibrating(true);
    try {
      const res = await recalibrateMultipliers(5);
      const updatedCount = res.updated_categories ? res.updated_categories.length : 0;
      if (updatedCount > 0) {
        onToast?.(`Recalibrated multipliers for: ${res.updated_categories.join(', ')}`);
      } else {
        onToast?.('Calibration ran: no categories have reached 5 logged duration samples yet.');
      }
      const [newPrefs, newStats] = await Promise.all([
        fetchUserPrefs(),
        fetchFeedbackStats().catch(() => null),
      ]);
      if (newPrefs) setMultipliers(newPrefs.category_duration_multiplier || {});
      if (newStats) setFeedbackStats(newStats);
    } catch (err) {
      onToast?.(err.message || 'Failed to recalibrate multipliers', 'error');
    } finally {
      setIsRecalibrating(false);
    }
  };

  // Filter blocks for currently selected day
  const dayBlocks = blocks
    .filter((b) => b.day_of_week === selectedDay)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      {/* Intro header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Routine Profile & Work Preferences
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Configure your fixed weekly commitments so the auto-scheduler only schedules tasks in free slots.
          </p>
        </div>
        <button
          onClick={() => openAddModal(selectedDay)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-medium text-xs shadow-sm transition-all cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add Commitment</span>
        </button>
      </div>

      {/* Day of Week Navigation */}
      <div className="grid grid-cols-7 gap-1.5 p-1.5 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs">
        {DAYS.map((day) => {
          const count = blocks.filter((b) => b.day_of_week === day.id).length;
          const isActive = selectedDay === day.id;
          return (
            <button
              key={day.id}
              onClick={() => setSelectedDay(day.id)}
              className={`flex flex-col items-center py-2 px-1 rounded-xl transition-all cursor-pointer ${
                isActive
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-800/50'
              }`}
            >
              <span>{day.short}</span>
              <span
                className={`text-[10px] mt-0.5 px-1.5 py-0.2 rounded-full ${
                  count > 0
                    ? isActive
                      ? 'bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 font-bold'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    : 'text-slate-400 opacity-60'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Routine Blocks for Selected Day */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider px-1">
          <span>{DAYS[selectedDay].name} Commitments</span>
          <span>{dayBlocks.length} scheduled</span>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-slate-400 text-sm">
            <Clock className="w-5 h-5 mx-auto animate-spin mb-2 opacity-50" />
            Loading routine...
          </div>
        ) : dayBlocks.length > 0 ? (
          <div className="space-y-2">
            {dayBlocks.map((block) => (
              <div
                key={block.id}
                className="flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 hover:shadow-xs transition-shadow"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 shrink-0">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                        {block.label || 'Commitment'}
                      </span>
                      {block.fixed && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          <Lock className="w-2.5 h-2.5" /> Fixed
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                      {block.start_time.slice(0, 5)} – {block.end_time.slice(0, 5)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEditModal(block)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Edit block"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteBlock(block.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                    title="Delete block"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-10 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-6">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              No routine commitments set for {DAYS[selectedDay].name}
            </p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Add your daily meetings, meals, gym time, or sleep blocks so MindFlow protects this time.
            </p>
            <button
              onClick={() => openAddModal(selectedDay)}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Add block for {DAYS[selectedDay].short}
            </button>
          </div>
        )}
      </div>

      {/* User Preferences Section */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <Sliders className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Scheduling Preferences
          </h3>
        </div>

        <form onSubmit={handleSavePrefs} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                Preferred Deep Work Hours (JSON/List)
              </label>
              <input
                type="text"
                value={deepHoursInput}
                onChange={(e) => setDeepHoursInput(e.target.value)}
                placeholder="09:00-11:00, 14:00-16:00"
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                High priority / deep tasks will prefer these windows.
              </p>
            </div>

            <div>
              <label className="block font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                Break Duration Between Deep Tasks (Minutes)
              </label>
              <input
                type="number"
                min="0"
                max="60"
                value={breakDuration}
                onChange={(e) => setBreakDuration(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Inserted automatically after any focus task &gt; 45min.
              </p>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSavingPrefs}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-sm transition-colors cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSavingPrefs ? 'Saving...' : 'Save Preferences'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Learning Loop & Duration Calibration Card (SPEC 1.7) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Duration Multiplier Learning Loop
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Learns your personal pacing from actual vs. estimated completion times (SPEC 1.7)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRecalibrate}
            disabled={isRecalibrating}
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRecalibrating ? 'animate-spin' : ''}`} />
            <span>{isRecalibrating ? 'Recalibrating...' : 'Recalibrate Now'}</span>
          </button>
        </div>

        {/* Stats summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Feedback Logs
            </span>
            <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {feedbackStats?.total_entries ?? 0}
            </div>
            <span className="text-[11px] text-slate-500">Total items completed</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Duration Samples
            </span>
            <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {feedbackStats?.samples_with_duration ?? 0}
            </div>
            <span className="text-[11px] text-slate-500">With actual time recorded</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Active Multipliers
            </span>
            <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
              {Object.keys(multipliers).length}
            </div>
            <span className="text-[11px] text-slate-500">Categories / topics calibrated</span>
          </div>
        </div>

        {/* Category sample progress toward 5-item threshold */}
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              Category Sample Progress (Threshold: 5 samples)
            </span>
            <span className="text-[11px] text-slate-400">
              Clamped between 0.5x and 3.0x
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
            {['task', 'deadline', 'reminder', 'idea'].map((cat) => {
              const count = feedbackStats?.category_counts?.[cat] || 0;
              const mult = multipliers[cat];
              const pct = Math.min(100, Math.round((count / 5) * 100));
              const isCalibrated = count >= 5;

              return (
                <div
                  key={cat}
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/30 flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold capitalize text-slate-800 dark:text-slate-200">
                      {cat}
                    </span>
                    {mult !== undefined ? (
                      <span className="px-1.5 py-0.5 rounded text-[11px] font-mono font-bold bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                        {mult}x
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-400">1.0x (default)</span>
                    )}
                  </div>

                  <div className="w-full bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden mb-1">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isCalibrated ? 'bg-emerald-500' : 'bg-indigo-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>{count}/5 samples</span>
                    <span className={isCalibrated ? 'text-emerald-600 dark:text-emerald-400 font-medium' : ''}>
                      {isCalibrated ? 'Calibrated' : 'Learning'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Topic Multipliers if present */}
        {feedbackStats?.topic_counts && Object.keys(feedbackStats.topic_counts).length > 0 && (
          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="font-semibold text-xs text-slate-700 dark:text-slate-300 block">
              Observed Topic Tags
            </span>
            <div className="flex flex-wrap gap-2">
              {Object.entries(feedbackStats.topic_counts).map(([topic, count]) => {
                const mult = multipliers[topic];
                return (
                  <span
                    key={topic}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                  >
                    <span className="font-medium">#{topic}</span>
                    <span className="text-[10px] text-slate-400">({count} samples)</span>
                    {mult !== undefined && (
                      <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 ml-1">
                        {mult}x
                      </span>
                    )}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Routine Block Modal */}
      {isModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {editingBlock ? 'Edit Routine Block' : 'Add Routine Commitment'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveBlock} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Day of Week
                </label>
                <select
                  value={dayOfWeek}
                  onChange={(e) => setDayOfWeek(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {DAYS.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Label
                </label>
                <input
                  type="text"
                  placeholder="e.g. Lunch, Standup, Sleep, Gym"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                    End Time
                  </label>
                  <input
                    type="time"
                    required
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="fixed-toggle"
                  checked={isFixed}
                  onChange={(e) => setIsFixed(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="fixed-toggle" className="text-slate-700 dark:text-slate-300 cursor-pointer">
                  Fixed commitment (cannot be rescheduled or overwritten by auto-scheduler)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingBlock}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSavingBlock ? 'Saving...' : editingBlock ? 'Save Changes' : 'Add Block'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

