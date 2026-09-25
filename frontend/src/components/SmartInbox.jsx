import React, { useState, useMemo } from 'react';
import ItemCard from './ItemCard';
import {
  Inbox,
  Filter,
  ArrowUpDown,
  Search,
  CheckCircle,
  Layers,
  Inbox as EmptyInboxIcon,
} from 'lucide-react';
import Skeleton from './ui/Skeleton';
import EmptyState from './ui/EmptyState';

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
  const [sortBy, setSortBy] = useState('newest');

  const categories = [
    { id: 'all', label: 'All' },
    { id: 'task', label: 'Tasks' },
    { id: 'idea', label: 'Ideas' },
    { id: 'reminder', label: 'Reminders' },
    { id: 'deadline', label: 'Deadlines' },
  ];

  const filteredAndSortedItems = useMemo(() => {
    let result = [...items];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (it) =>
          it.raw_text.toLowerCase().includes(q) ||
          (it.topic_tag && it.topic_tag.toLowerCase().includes(q))
      );
    }

    if (categoryFilter !== 'all') {
      result = result.filter((it) => it.category === categoryFilter);
    }

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
      {/* Top Bar: Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#e2ded5] dark:border-[#383530] pb-3">
        {/* Status navigation */}
        <div className="flex items-center gap-1 bg-[#f4f2ee] dark:bg-[#282623] p-1 rounded-xl text-xs font-medium border border-[#e2ded5] dark:border-[#383530]">
          <button
            onClick={() => setStatusFilter('inbox')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              statusFilter === 'inbox'
                ? 'bg-[#ffffff] dark:bg-[#1f1e1d] text-[#2d553c] dark:text-[#5b8a6c] shadow-xs font-semibold'
                : 'text-[#6b6760] dark:text-[#9e998f] hover:text-[#1f1e1d] dark:hover:text-[#ebe8e2]'
            }`}
          >
            <Inbox className="w-3.5 h-3.5" />
            <span>Inbox</span>
            {statusFilter === 'inbox' && (
              <span className="px-1.5 py-0.2 rounded-full bg-[#2d553c]/10 text-[#2d553c] dark:text-[#5b8a6c] text-[10px] font-semibold">
                {items.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setStatusFilter('done')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              statusFilter === 'done'
                ? 'bg-[#ffffff] dark:bg-[#1f1e1d] text-[#2d553c] dark:text-[#5b8a6c] shadow-xs font-semibold'
                : 'text-[#6b6760] dark:text-[#9e998f] hover:text-[#1f1e1d] dark:hover:text-[#ebe8e2]'
            }`}
          >
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Done</span>
          </button>

          <button
            onClick={() => setStatusFilter(null)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              statusFilter === null
                ? 'bg-[#ffffff] dark:bg-[#1f1e1d] text-[#1f1e1d] dark:text-[#ebe8e2] shadow-xs font-semibold'
                : 'text-[#6b6760] dark:text-[#9e998f] hover:text-[#1f1e1d] dark:hover:text-[#ebe8e2]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>All</span>
          </button>
        </div>

        {/* Search input */}
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#9e998f]" />
          <input
            type="text"
            placeholder="Search items or #tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-[#ffffff] dark:bg-[#1f1e1d] border border-[#e2ded5] dark:border-[#383530] rounded-lg placeholder-[#9e998f] text-[#1f1e1d] dark:text-[#ebe8e2] focus:outline-none focus:ring-1 focus:ring-[#2d553c]"
          />
        </div>
      </div>

      {/* Filter and Sort bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        {/* Category filter pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[#6b6760] dark:text-[#9e998f] text-xs mr-1 flex items-center gap-1">
            <Filter className="w-3 h-3" /> Category:
          </span>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategoryFilter(cat.id)}
              className={`px-2.5 py-1 rounded-lg border transition-colors cursor-pointer text-xs ${
                categoryFilter === cat.id
                  ? 'border-[#2d553c] bg-[#2d553c]/10 text-[#2d553c] dark:border-[#5b8a6c] dark:text-[#ebe8e2] font-semibold'
                  : 'border-[#e2ded5] dark:border-[#383530] bg-[#ffffff] dark:bg-[#1f1e1d] text-[#6b6760] dark:text-[#9e998f] hover:border-[#b8b3a7]'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Sort dropdown */}
        <div className="flex items-center gap-1.5 text-[#6b6760] dark:text-[#9e998f]">
          <ArrowUpDown className="w-3 h-3" />
          <span className="text-xs">Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-[#ffffff] dark:bg-[#1f1e1d] border border-[#e2ded5] dark:border-[#383530] rounded-lg px-2 py-1 text-xs text-[#1f1e1d] dark:text-[#ebe8e2] focus:outline-none cursor-pointer"
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
          <div className="space-y-3 py-4">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
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
          <EmptyState
            icon={EmptyInboxIcon}
            title={
              searchQuery || categoryFilter !== 'all'
                ? 'No matching items'
                : statusFilter === 'done'
                ? 'No completed items yet'
                : 'Inbox is clear'
            }
            description={
              searchQuery || categoryFilter !== 'all'
                ? 'Try adjusting your search query or filter chips.'
                : 'Dump thoughts, ideas, or study goals above. MindFlow will categorize and prioritize them for you.'
            }
          />
        )}
      </div>
    </div>
  );
}
