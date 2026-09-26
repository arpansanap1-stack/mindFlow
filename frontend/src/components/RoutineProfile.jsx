import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  Plus,
  Trash2,
  Edit3,
  Sliders,
  Lock,
  Save,
  RefreshCw,
  Gauge,
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
import Button from './ui/Button';
import Modal from './ui/Modal';
import Skeleton from './ui/Skeleton';
import EmptyState from './ui/EmptyState';
import TimePicker12 from './TimePicker12';
import {
  formatTimeRange12,
  formatDeepHoursForDisplay,
  parseDeepHoursInput,
} from '../utils/timeFormat';


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
  const [selectedDay, setSelectedDay] = useState(0);
  const [blocks, setBlocks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState(null);
  const [dayOfWeek, setDayOfWeek] = useState(0);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [label, setLabel] = useState('');
  const [isFixed, setIsFixed] = useState(true);
  const [isSavingBlock, setIsSavingBlock] = useState(false);

  const [deepHoursInput, setDeepHoursInput] = useState('09:00-11:00');
  const [breakDuration, setBreakDuration] = useState(10);
  const [multipliers, setMultipliers] = useState({});
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);

  const [feedbackStats, setFeedbackStats] = useState(null);
  const [isRecalibrating, setIsRecalibrating] = useState(false);

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
          formatDeepHoursForDisplay(prefsData.preferred_deep_hours || ['09:00-11:00'])
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
      const hoursList = parseDeepHoursInput(deepHoursInput);

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

  const dayBlocks = blocks
    .filter((b) => b.day_of_week === selectedDay)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#e2ded5] dark:border-[#383530]">
        <div>
          <h2 className="text-lg font-semibold text-[#1f1e1d] dark:text-[#ebe8e2] flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#2d553c] dark:text-[#5b8a6c]" />
            Routine & Commitments
          </h2>
          <p className="text-xs text-[#6b6760] dark:text-[#9e998f] mt-0.5">
            Configure classes, sleep, and meals so MindFlow plans study goals around them.
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => openAddModal(selectedDay)}
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          <span>Add Commitment</span>
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1.5 p-1 bg-[#f4f2ee] dark:bg-[#282623] rounded-xl border border-[#e2ded5] dark:border-[#383530] text-xs">
        {DAYS.map((day) => {
          const count = blocks.filter((b) => b.day_of_week === day.id).length;
          const isActive = selectedDay === day.id;
          return (
            <button
              key={day.id}
              onClick={() => setSelectedDay(day.id)}
              className={`flex flex-col items-center py-2 px-1 rounded-lg transition-colors cursor-pointer ${
                isActive
                  ? 'bg-[#ffffff] dark:bg-[#1f1e1d] text-[#2d553c] dark:text-[#5b8a6c] shadow-xs font-semibold'
                  : 'text-[#6b6760] dark:text-[#9e998f] hover:bg-[#ffffff]/50 dark:hover:bg-[#1f1e1d]/50'
              }`}
            >
              <span>{day.short}</span>
              <span
                className={`text-[10px] mt-0.5 px-1.5 py-0.2 rounded-full ${
                  count > 0
                    ? isActive
                      ? 'bg-[#2d553c]/10 text-[#2d553c] dark:text-[#5b8a6c] font-semibold'
                      : 'bg-[#e2ded5] dark:bg-[#383530] text-[#6b6760] dark:text-[#9e998f]'
                    : 'text-[#9e998f] opacity-50'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-medium text-[#6b6760] dark:text-[#9e998f] px-1">
          <span>{DAYS[selectedDay].name} Commitments</span>
          <span>{dayBlocks.length} scheduled</span>
        </div>

        {isLoading ? (
          <div className="space-y-2 py-4">
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
          </div>
        ) : dayBlocks.length > 0 ? (
          <div className="space-y-2">
            {dayBlocks.map((block) => (
              <div
                key={block.id}
                className="flex items-center justify-between bg-[#ffffff] dark:bg-[#1f1e1d] border border-[#e2ded5] dark:border-[#383530] rounded-xl p-3.5 hover:border-[#b8b3a7] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[#f4f2ee] dark:bg-[#282623] text-[#2d553c] dark:text-[#5b8a6c] shrink-0 border border-[#e2ded5] dark:border-[#383530]">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-[#1f1e1d] dark:text-[#ebe8e2]">
                        {block.label || 'Commitment'}
                      </span>
                      {block.fixed && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#f4f2ee] dark:bg-[#282623] text-[#6b6760] dark:text-[#9e998f] border border-[#e2ded5] dark:border-[#383530]">
                          <Lock className="w-2.5 h-2.5" /> Fixed
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#6b6760] dark:text-[#9e998f] font-mono mt-0.5">
                      {formatTimeRange12(block.start_time, block.end_time)}
                    </p>

                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEditModal(block)}
                    className="p-1.5 rounded-lg text-[#6b6760] hover:text-[#1f1e1d] dark:hover:text-[#ebe8e2] hover:bg-[#f4f2ee] dark:hover:bg-[#282623] transition-colors cursor-pointer"
                    title="Edit block"
                    aria-label="Edit block"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteBlock(block.id)}
                    className="p-1.5 rounded-lg text-[#6b6760] hover:text-[#7d3b2b] dark:hover:text-[#d48372] hover:bg-[#7d3b2b]/10 transition-colors cursor-pointer"
                    title="Delete block"
                    aria-label="Delete block"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Calendar}
            title={`No commitments set for ${DAYS[selectedDay].name}`}
            description="Add lectures, labs, gym, sleep, or meal hours so MindFlow knows when you are busy."
            actionLabel={`Add for ${DAYS[selectedDay].short}`}
            onAction={() => openAddModal(selectedDay)}
          />
        )}
      </div>

      <div className="bg-[#ffffff] dark:bg-[#1f1e1d] border border-[#e2ded5] dark:border-[#383530] rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2 border-b border-[#e2ded5] dark:border-[#383530] pb-3">
          <Sliders className="w-4 h-4 text-[#2d553c] dark:text-[#5b8a6c]" />
          <h3 className="text-sm font-semibold text-[#1f1e1d] dark:text-[#ebe8e2]">
            Scheduling Preferences
          </h3>
        </div>

        <form onSubmit={handleSavePrefs} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-medium text-[#1f1e1d] dark:text-[#ebe8e2] mb-1">
                Preferred Focus Windows (e.g. 09:00-11:00)
              </label>
              <input
                type="text"
                value={deepHoursInput}
                onChange={(e) => setDeepHoursInput(e.target.value)}
                placeholder="09:00-11:00, 14:00-16:00"
                className="w-full px-3 py-2 text-xs bg-[#fbfaf8] dark:bg-[#1f1e1d] border border-[#e2ded5] dark:border-[#383530] rounded-lg text-[#1f1e1d] dark:text-[#ebe8e2] focus:outline-none focus:ring-1 focus:ring-[#2d553c] font-mono"
              />
              <p className="text-[11px] text-[#6b6760] dark:text-[#9e998f] mt-1">
                High priority / deep tasks will prefer these open hours.
              </p>
            </div>

            <div>
              <label className="block font-medium text-[#1f1e1d] dark:text-[#ebe8e2] mb-1">
                Break Duration Between Deep Tasks (Minutes)
              </label>
              <input
                type="number"
                min="0"
                max="60"
                value={breakDuration}
                onChange={(e) => setBreakDuration(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#fbfaf8] dark:bg-[#1f1e1d] border border-[#e2ded5] dark:border-[#383530] rounded-lg text-[#1f1e1d] dark:text-[#ebe8e2] focus:outline-none focus:ring-1 focus:ring-[#2d553c]"
              />
              <p className="text-[11px] text-[#6b6760] dark:text-[#9e998f] mt-1">
                Inserted automatically after tasks longer than 45 min.
              </p>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isSavingPrefs}
            >
              <Save className="w-3.5 h-3.5 mr-1" />
              <span>{isSavingPrefs ? 'Saving...' : 'Save Preferences'}</span>
            </Button>
          </div>
        </form>
      </div>

      <div className="bg-[#ffffff] dark:bg-[#1f1e1d] border border-[#e2ded5] dark:border-[#383530] rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#e2ded5] dark:border-[#383530] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#2d553c]/10 text-[#2d553c] dark:text-[#5b8a6c]">
              <Gauge className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#1f1e1d] dark:text-[#ebe8e2]">
                Personal Pacing Calibration
              </h3>
              <p className="text-xs text-[#6b6760] dark:text-[#9e998f]">
                Learns your real completion speed to make schedules more realistic
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRecalibrate}
            disabled={isRecalibrating}
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isRecalibrating ? 'animate-spin' : ''}`} />
            <span>{isRecalibrating ? 'Recalibrating...' : 'Recalibrate'}</span>
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 rounded-lg bg-[#f4f2ee] dark:bg-[#282623] border border-[#e2ded5] dark:border-[#383530]">
            <span className="text-[11px] font-medium text-[#6b6760] dark:text-[#9e998f] block mb-1">
              Feedback Logs
            </span>
            <div className="text-base font-semibold text-[#1f1e1d] dark:text-[#ebe8e2]">
              {feedbackStats?.total_entries ?? 0}
            </div>
            <span className="text-[11px] text-[#6b6760] dark:text-[#9e998f]">Completed items</span>
          </div>

          <div className="p-3 rounded-lg bg-[#f4f2ee] dark:bg-[#282623] border border-[#e2ded5] dark:border-[#383530]">
            <span className="text-[11px] font-medium text-[#6b6760] dark:text-[#9e998f] block mb-1">
              Duration Samples
            </span>
            <div className="text-base font-semibold text-[#1f1e1d] dark:text-[#ebe8e2]">
              {feedbackStats?.samples_with_duration ?? 0}
            </div>
            <span className="text-[11px] text-[#6b6760] dark:text-[#9e998f]">With actual duration</span>
          </div>

          <div className="p-3 rounded-lg bg-[#f4f2ee] dark:bg-[#282623] border border-[#e2ded5] dark:border-[#383530]">
            <span className="text-[11px] font-medium text-[#6b6760] dark:text-[#9e998f] block mb-1">
              Active Multipliers
            </span>
            <div className="text-base font-semibold text-[#2d553c] dark:text-[#5b8a6c]">
              {Object.keys(multipliers).length}
            </div>
            <span className="text-[11px] text-[#6b6760] dark:text-[#9e998f]">Categories calibrated</span>
          </div>
        </div>

        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-[#1f1e1d] dark:text-[#ebe8e2]">
              Category Calibration (Target: 5 completed samples)
            </span>
            <span className="text-[11px] text-[#6b6760] dark:text-[#9e998f]">
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
                  className="p-3 rounded-lg border border-[#e2ded5] dark:border-[#383530] bg-[#ffffff] dark:bg-[#1f1e1d] flex flex-col justify-between"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium capitalize text-[#1f1e1d] dark:text-[#ebe8e2]">
                      {cat}
                    </span>
                    {mult !== undefined ? (
                      <span className="px-1.5 py-0.5 rounded text-[11px] font-mono font-medium bg-[#2d553c]/10 text-[#2d553c] dark:text-[#5b8a6c] border border-[#2d553c]/20">
                        {mult}x
                      </span>
                    ) : (
                      <span className="text-[11px] text-[#6b6760] dark:text-[#9e998f]">1.0x (std)</span>
                    )}
                  </div>

                  <div className="w-full bg-[#f4f2ee] dark:bg-[#282623] h-1.5 rounded-full overflow-hidden mb-1">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isCalibrated ? 'bg-[#2d553c] dark:bg-[#5b8a6c]' : 'bg-[#6b6760]'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-[#6b6760] dark:text-[#9e998f]">
                    <span>{count}/5 samples</span>
                    <span className={isCalibrated ? 'text-[#2d553c] dark:text-[#5b8a6c] font-medium' : ''}>
                      {isCalibrated ? 'Calibrated' : 'Learning'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingBlock ? 'Edit Routine Commitment' : 'Add Routine Commitment'}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSaveBlock} className="space-y-4 text-xs">
          <div>
            <label className="block font-medium text-[#1f1e1d] dark:text-[#ebe8e2] mb-1">
              Day of Week
            </label>
            <select
              value={dayOfWeek}
              onChange={(e) => setDayOfWeek(Number(e.target.value))}
              className="w-full px-3 py-2 bg-[#ffffff] dark:bg-[#1f1e1d] border border-[#e2ded5] dark:border-[#383530] rounded-lg text-[#1f1e1d] dark:text-[#ebe8e2] focus:outline-none focus:ring-1 focus:ring-[#2d553c]"
            >
              {DAYS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-medium text-[#1f1e1d] dark:text-[#ebe8e2] mb-1">
              Label
            </label>
            <input
              type="text"
              placeholder="e.g. Lectures, Gym, Sleep, Lunch"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full px-3 py-2 bg-[#ffffff] dark:bg-[#1f1e1d] border border-[#e2ded5] dark:border-[#383530] rounded-lg text-[#1f1e1d] dark:text-[#ebe8e2] focus:outline-none focus:ring-1 focus:ring-[#2d553c]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TimePicker12
              label="Start Time"
              value={startTime}
              onChange={setStartTime}
            />
            <TimePicker12
              label="End Time"
              value={endTime}
              onChange={setEndTime}
            />
          </div>


          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="fixed-toggle"
              checked={isFixed}
              onChange={(e) => setIsFixed(e.target.checked)}
              className="rounded border-[#e2ded5] text-[#2d553c] focus:ring-[#2d553c]"
            />
            <label htmlFor="fixed-toggle" className="text-[#3b3834] dark:text-[#d3cebe] cursor-pointer">
              Fixed commitment (auto-scheduler will never overwrite this time)
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#e2ded5] dark:border-[#383530]">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSavingBlock}
            >
              {isSavingBlock ? 'Saving...' : editingBlock ? 'Save Changes' : 'Add Commitment'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
