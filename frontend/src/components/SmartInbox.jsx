import React, { useState, useMemo } from 'react';
import ItemCard from './ItemCard';
import {
  Inbox,
  Filter,
  ArrowUpDown,
  Search,
  CheckCircle,
  Clock,
  Sparkles,
  Layers,
} from 'lucide-react';

export default function SmartInbox({
  items,
  isLoading,
  onCompleteItem,
  onEditItem,
  onDeleteItem,
  statusFilter,
  setStatusFilter,
}) {
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest'); // 'newest', 'priority', 'duration_asc', 'duration_desc', 'deadline'

  // Categories config
  const categories = [
    { id: 'all', label: 'All' },
    { id: 'task', label: 'Tasks' },
    { id: 'idea', label: 'Ideas' },
    { id: 'reminder', label: 'Reminders' },
    { id: 'deadline', label: 'Deadlines' },
  ];

  // Filtering & sorting logic
  const filteredAndSortedItems = useMemo(() => {
    let result = [...items];

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (it) =>
          it.raw_text.toLowerCase().includes(q) ||
          (it.topic_tag && it.topic_tag.toLowerCase().includes(q))
      );
    }

    // Filter by category
    if (categoryFilter !== 'all') {
      result = result.filter((it) => it.category === categoryFilter);
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.created_at) - new Date(a.created_at);
      }
      if (sortBy === 'priority') {
        const pa = a.priority || 0;
        const pb = b.priority || 0;
        return pb - pa;
      }
      if (sortBy === 'duration_asc') {
        const da = a.est_duration_min || 999999;
        const db = b.est_duration_min || 999999;
        return da - db;
      }
      if (sortBy === 'duration_desc') {
        const da = a.est_duration_min || 0;
        const db = b.est_duration_min || 0;
        return db - da;
      }
      if (sortBy === 'deadline') {
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline) - new Date(b.deadline);
      }
      return 0;
    });

    return result;
  }, [items, searchQuery, categoryFilter, sortBy]);

  return (
    <div className="w-full max-w-3xl mx-auto space-y-4">
      {/* Top Bar: Tabs & Counters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        {/* Status navigation */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl text-xs font-medium">
          <button
            onClick={() => setStatusFilter('inbox')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              statusFilter === 'inbox'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Inbox className="w-3.5 h-3.5" />
            <span>Inbox</span>
            {statusFilter === 'inbox' && (
              <span className="px-1.5 py-0.2 rounded-full bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 text-[10px]">
                {items.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setStatusFilter('done')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              statusFilter === 'done'
                ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Done</span>
          </button>

          <button
            onClick={() => setStatusFilter(null)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              statusFilter === null
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>All</span>
          </button>
        </div>

        {/* Search input */}
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search items or #tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl placeholder-slate-400 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Filter and Sort bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        {/* Category filter pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-slate-400 text-xs mr-1 flex items-center gap-1">
            <Filter className="w-3 h-3" /> Category:
          </span>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategoryFilter(cat.id)}
              className={`px-2.5 py-1 rounded-lg border transition-colors cursor-pointer text-xs ${
                categoryFilter === cat.id
                  ? 'border-indigo-600 dark:border-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-medium'
                  : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Sort dropdown */}
        <div className="flex items-center gap-1.5 text-slate-500">
          <ArrowUpDown className="w-3 h-3" />
          <span className="text-xs">Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
          >
            <option value="newest">Newest first</option>
            <option value="priority">Highest priority</option>
            <option value="duration_asc">Shortest duration</option>
            <option value="duration_desc">Longest duration</option>
            <option value="deadline">Soonest deadline</option>
          </select>
        </div>
      </div>

      {/* Item list */}
      <div className="space-y-2.5 pt-2">
        {isLoading ? (
          <div className="py-16 text-center text-slate-400 text-sm">
            <Clock className="w-6 h-6 mx-auto animate-spin mb-2 opacity-50" />
            Loading inbox...
          </div>
        ) : filteredAndSortedItems.length > 0 ? (
          filteredAndSortedItems.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              onComplete={onCompleteItem}
              onEdit={onEditItem}
              onDelete={onDeleteItem}
            />
          ))
        ) : (
          <div className="py-16 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-8">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 mx-auto flex items-center justify-center mb-3">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="text-slate-800 dark:text-slate-200 font-semibold text-base mb-1">
              {searchQuery || categoryFilter !== 'all'
                ? 'No matching items'
                : statusFilter === 'done'
                ? 'No completed items yet'
                : 'Inbox is clear!'}
            </h3>
            <p className="text-slate-400 text-xs max-w-sm mx-auto">
              {searchQuery || categoryFilter !== 'all'
                ? 'Try adjusting your search query or filter chips.'
                : 'Use the quick capture bar above to capture your next fleeting thought or task.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

