import React, { useState, useEffect } from 'react';
import {
  Compass,
  Inbox,
  CalendarDays,
  Sliders,
  Shield,
  LogOut,
  KeyRound,
  User,
  Leaf,
  Clock,
  Timer,
} from 'lucide-react';

export default function Header({
  isOnline,
  activeTab,
  onSelectTab,
  currentUser,
  onLogout,
  onChangePassword,
  onOpenTimer,
}) {
  const isAdmin = currentUser?.role === 'ADMIN';

  const [currentTimeStr, setCurrentTimeStr] = useState('');
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      let hours = now.getHours();
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const period = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      setCurrentTimeStr(`${hours}:${minutes} ${period}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);


  return (
    <header className="border-b border-[#e2ded5] dark:border-[#383530] bg-[#fbfaf8]/90 dark:bg-[#1f1e1d]/90 backdrop-blur-md sticky top-0 z-40 transition-colors">
      <div className="max-w-4xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Branding */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#2d553c] text-white flex items-center justify-center shadow-xs">
            <Leaf className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold text-[#1f1e1d] dark:text-[#ebe8e2] tracking-tight leading-none">
                MindFlow
              </h1>
              <span className="text-[10px] font-medium tracking-wide px-1.5 py-0.5 rounded bg-[#f4f2ee] dark:bg-[#282623] text-[#6b6760] dark:text-[#9e998f] border border-[#e2ded5] dark:border-[#383530]">
                Workspace
              </span>
            </div>
            <p className="text-[11px] text-[#6b6760] dark:text-[#9e998f] hidden sm:block">
              Calm personal task & thought organizer
            </p>
          </div>
        </div>

        {/* Center: Desktop Navigation tabs */}
        <nav
          aria-label="Main Navigation"
          className="hidden sm:flex items-center gap-1 bg-[#f4f2ee] dark:bg-[#282623] p-1 rounded-xl text-xs font-medium border border-[#e2ded5] dark:border-[#383530]"
        >
          <button
            onClick={() => onSelectTab('today')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              activeTab === 'today'
                ? 'bg-[#ffffff] dark:bg-[#1f1e1d] text-[#2d553c] dark:text-[#5b8a6c] font-semibold shadow-xs'
                : 'text-[#6b6760] dark:text-[#9e998f] hover:text-[#1f1e1d] dark:hover:text-[#ebe8e2]'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Today</span>
          </button>

          <button
            onClick={() => onSelectTab('inbox')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              activeTab === 'inbox'
                ? 'bg-[#ffffff] dark:bg-[#1f1e1d] text-[#2d553c] dark:text-[#5b8a6c] font-semibold shadow-xs'
                : 'text-[#6b6760] dark:text-[#9e998f] hover:text-[#1f1e1d] dark:hover:text-[#ebe8e2]'
            }`}
          >
            <Inbox className="w-3.5 h-3.5" />
            <span>Inbox</span>
          </button>

          <button
            onClick={() => onSelectTab('schedule')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              activeTab === 'schedule'
                ? 'bg-[#ffffff] dark:bg-[#1f1e1d] text-[#2d553c] dark:text-[#5b8a6c] font-semibold shadow-xs'
                : 'text-[#6b6760] dark:text-[#9e998f] hover:text-[#1f1e1d] dark:hover:text-[#ebe8e2]'
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            <span>Day Plan</span>
          </button>

          <button
            onClick={() => onSelectTab('routine')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              activeTab === 'routine'
                ? 'bg-[#ffffff] dark:bg-[#1f1e1d] text-[#2d553c] dark:text-[#5b8a6c] font-semibold shadow-xs'
                : 'text-[#6b6760] dark:text-[#9e998f] hover:text-[#1f1e1d] dark:hover:text-[#ebe8e2]'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Routine</span>
          </button>

          {isAdmin && (
            <button
              onClick={() => onSelectTab('admin')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                activeTab === 'admin'
                  ? 'bg-[#7d3b2b] text-white shadow-xs'
                  : 'text-[#7d3b2b] dark:text-[#d48372] hover:bg-[#7d3b2b]/10'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Admin</span>
            </button>
          )}
        </nav>

        {/* Right: Clock, Timer, User identity & Connection Status */}
        <div className="flex items-center gap-2">
          {/* Live 12-Hour Clock */}
          {currentTimeStr && (
            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-bold text-[#2d553c] dark:text-[#5b8a6c] bg-[#2d553c]/5 border border-[#2d553c]/20">
              <Clock className="w-3.5 h-3.5 text-[#2d553c] dark:text-[#5b8a6c]" />
              <span>{currentTimeStr}</span>
            </div>
          )}

          {/* Focus Timer Trigger Button */}
          {onOpenTimer && (
            <button
              onClick={onOpenTimer}
              title="Open Focus Timer"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors cursor-pointer"
            >
              <Timer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Timer</span>
            </button>
          )}

          {/* Connection badge */}
          <div
            className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium border ${
              isOnline
                ? 'bg-[#2d553c]/5 text-[#2d553c] dark:text-[#5b8a6c] border-[#2d553c]/20'
                : 'bg-[#b8860b]/5 text-[#8c6508] dark:text-[#d4a843] border-[#b8860b]/20'
            }`}
            title={isOnline ? 'Connected to MindFlow backend' : 'Backend offline or unreachable'}
          >

            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isOnline ? 'bg-[#2d553c] dark:bg-[#5b8a6c]' : 'bg-[#b8860b]'
              }`}
            />
            <span className="hidden md:inline">
              {isOnline ? 'Synced' : 'Offline'}
            </span>
          </div>

          {currentUser && (
            <div className="flex items-center gap-1 pl-1 border-l border-[#e2ded5] dark:border-[#383530]">
              <div
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs bg-[#f4f2ee] dark:bg-[#282623] text-[#3b3834] dark:text-[#d3cebe] border border-[#e2ded5] dark:border-[#383530]"
                title={`Signed in as ${currentUser.email}`}
              >
                <User className="w-3.5 h-3.5 text-[#6b6760] dark:text-[#9e998f]" />
                <span className="max-w-[110px] sm:max-w-[140px] truncate font-medium">
                  {currentUser.email.split('@')[0]}
                </span>
                {isAdmin && (
                  <span className="text-[10px] uppercase font-bold tracking-wider px-1 py-0.2 rounded bg-[#7d3b2b]/10 text-[#7d3b2b] dark:text-[#d48372]">
                    Admin
                  </span>
                )}
              </div>

              {onChangePassword && (
                <button
                  onClick={onChangePassword}
                  title="Change Password"
                  aria-label="Change Password"
                  className="p-1.5 rounded-lg text-[#6b6760] dark:text-[#9e998f] hover:text-[#1f1e1d] dark:hover:text-[#ebe8e2] hover:bg-[#f4f2ee] dark:hover:bg-[#282623] transition-colors cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                </button>
              )}

              {onLogout && (
                <button
                  onClick={onLogout}
                  title="Sign Out"
                  aria-label="Sign Out"
                  className="p-1.5 rounded-lg text-[#6b6760] dark:text-[#9e998f] hover:text-[#7d3b2b] dark:hover:text-[#d48372] hover:bg-[#7d3b2b]/10 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
