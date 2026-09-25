import React from 'react';
import {
  Compass,
  Inbox,
  CalendarDays,
  Sliders,
  Plus,
  Shield,
} from 'lucide-react';

export default function MobileNav({
  activeTab,
  onSelectTab,
  onOpenQuickAdd,
  currentUser,
}) {
  const isAdmin = currentUser?.role === 'ADMIN';

  return (
    <nav
      aria-label="Mobile Navigation"
      className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#fbfaf8]/95 dark:bg-[#1f1e1d]/95 backdrop-blur-md border-t border-[#e2ded5] dark:border-[#383530] px-3 py-1.5 transition-colors"
    >
      <div className="flex items-center justify-around max-w-md mx-auto">
        {/* Today Tab */}
        <button
          onClick={() => onSelectTab('today')}
          aria-label="Today"
          className={`flex flex-col items-center justify-center min-w-[56px] py-1 px-2 rounded-lg text-[11px] font-medium transition-colors ${
            activeTab === 'today'
              ? 'text-[#2d553c] dark:text-[#5b8a6c] font-semibold'
              : 'text-[#6b6760] dark:text-[#9e998f] hover:text-[#1f1e1d] dark:hover:text-[#ebe8e2]'
          }`}
        >
          <Compass className="w-5 h-5 mb-0.5" />
          <span>Today</span>
        </button>

        {/* Inbox Tab */}
        <button
          onClick={() => onSelectTab('inbox')}
          aria-label="Inbox"
          className={`flex flex-col items-center justify-center min-w-[56px] py-1 px-2 rounded-lg text-[11px] font-medium transition-colors ${
            activeTab === 'inbox'
              ? 'text-[#2d553c] dark:text-[#5b8a6c] font-semibold'
              : 'text-[#6b6760] dark:text-[#9e998f] hover:text-[#1f1e1d] dark:hover:text-[#ebe8e2]'
          }`}
        >
          <Inbox className="w-5 h-5 mb-0.5" />
          <span>Inbox</span>
        </button>

        {/* Quick Add Button */}
        {onOpenQuickAdd && (
          <button
            onClick={onOpenQuickAdd}
            aria-label="Quick Add Thought"
            className="flex items-center justify-center w-11 h-11 rounded-full bg-[#2d553c] text-white shadow-sm hover:bg-[#23432f] active:scale-95 transition-all -mt-3 border-2 border-[#fbfaf8] dark:border-[#1f1e1d]"
          >
            <Plus className="w-6 h-6" />
          </button>
        )}

        {/* Day Plan (Schedule) */}
        <button
          onClick={() => onSelectTab('schedule')}
          aria-label="Day Plan"
          className={`flex flex-col items-center justify-center min-w-[56px] py-1 px-2 rounded-lg text-[11px] font-medium transition-colors ${
            activeTab === 'schedule'
              ? 'text-[#2d553c] dark:text-[#5b8a6c] font-semibold'
              : 'text-[#6b6760] dark:text-[#9e998f] hover:text-[#1f1e1d] dark:hover:text-[#ebe8e2]'
          }`}
        >
          <CalendarDays className="w-5 h-5 mb-0.5" />
          <span>Plan</span>
        </button>

        {/* Routine / Routine Calibration */}
        <button
          onClick={() => onSelectTab('routine')}
          aria-label="Routine"
          className={`flex flex-col items-center justify-center min-w-[56px] py-1 px-2 rounded-lg text-[11px] font-medium transition-colors ${
            activeTab === 'routine'
              ? 'text-[#2d553c] dark:text-[#5b8a6c] font-semibold'
              : 'text-[#6b6760] dark:text-[#9e998f] hover:text-[#1f1e1d] dark:hover:text-[#ebe8e2]'
          }`}
        >
          <Sliders className="w-5 h-5 mb-0.5" />
          <span>Routine</span>
        </button>

        {/* Admin Tab if admin */}
        {isAdmin && (
          <button
            onClick={() => onSelectTab('admin')}
            aria-label="Admin"
            className={`flex flex-col items-center justify-center min-w-[56px] py-1 px-2 rounded-lg text-[11px] font-medium transition-colors ${
              activeTab === 'admin'
                ? 'text-[#7d3b2b] dark:text-[#d48372] font-semibold'
                : 'text-[#6b6760] dark:text-[#9e998f] hover:text-[#7d3b2b]'
            }`}
          >
            <Shield className="w-5 h-5 mb-0.5" />
            <span>Admin</span>
          </button>
        )}
      </div>
    </nav>
  );
}
