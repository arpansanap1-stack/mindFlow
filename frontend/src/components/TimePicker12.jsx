import React from 'react';
import { splitTime24, joinTime12To24 } from '../utils/timeFormat';

export default function TimePicker12({ value, onChange, label, className = '' }) {
  const { hour12, minute, period } = splitTime24(value);

  const handleHourChange = (e) => {
    const newHour = parseInt(e.target.value, 10) || 12;
    onChange(joinTime12To24(newHour, minute, period));
  };

  const handleMinuteChange = (e) => {
    const newMinute = parseInt(e.target.value, 10) || 0;
    onChange(joinTime12To24(hour12, newMinute, period));
  };

  const handlePeriodToggle = (newPeriod) => {
    if (newPeriod === period) return;
    onChange(joinTime12To24(hour12, minute, newPeriod));
  };

  const minutesOptions = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
  // Ensure current minute exists in dropdown even if not a multiple of 5
  if (!minutesOptions.includes(minute)) {
    minutesOptions.push(minute);
    minutesOptions.sort((a, b) => a - b);
  }

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          {label}
        </span>
      )}
      <div className="inline-flex items-center gap-1.5 bg-slate-900 border border-slate-700/80 rounded-xl p-1.5 shadow-inner">
        {/* Hour selector */}
        <select
          value={hour12}
          onChange={handleHourChange}
          className="bg-slate-800 text-slate-100 text-sm font-semibold rounded-lg px-2.5 py-1.5 border border-slate-700 focus:outline-none focus:border-indigo-500 cursor-pointer"
          aria-label="Hour"
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>

        <span className="text-slate-400 font-bold text-sm">:</span>

        {/* Minute selector */}
        <select
          value={minute}
          onChange={handleMinuteChange}
          className="bg-slate-800 text-slate-100 text-sm font-semibold rounded-lg px-2.5 py-1.5 border border-slate-700 focus:outline-none focus:border-indigo-500 cursor-pointer"
          aria-label="Minute"
        >
          {minutesOptions.map((m) => (
            <option key={m} value={m}>
              {String(m).padStart(2, '0')}
            </option>
          ))}
        </select>

        {/* AM / PM Segmented Control */}
        <div className="flex bg-slate-800 p-0.5 rounded-lg border border-slate-700 ml-1">
          <button
            type="button"
            onClick={() => handlePeriodToggle('AM')}
            className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
              period === 'AM'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            AM
          </button>
          <button
            type="button"
            onClick={() => handlePeriodToggle('PM')}
            className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
              period === 'PM'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            PM
          </button>
        </div>
      </div>
    </div>
  );
}
