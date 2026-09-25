import React from 'react';
import {
  CheckCircle2,
  Circle,
  Clock,
  Calendar,
  Tag,
  Trash2,
  Edit3,
  MoreVertical,
  Check,
} from 'lucide-react';
import Badge from './ui/Badge';
import DropdownMenu from './ui/DropdownMenu';

export default function ItemCard({
  item,
  onComplete,
  onEdit,
  onDelete,
}) {
  const isDone = item.status === 'done';

  const formatDeadline = (iso) => {
    if (!iso) return null;
    try {
      const d = new Date(iso);
      const isToday = new Date().toDateString() === d.toDateString();
      if (isToday) {
        return `Today ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      }
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  const menuItems = [
    {
      label: 'Edit details',
      icon: Edit3,
      onClick: () => onEdit(item),
    },
    {
      label: isDone ? 'Mark as active' : 'Complete task',
      icon: isDone ? Circle : Check,
      onClick: () => onComplete(item),
    },
    {
      label: 'Delete',
      icon: Trash2,
      danger: true,
      onClick: () => onDelete(item.id),
    },
  ];

  return (
    <div
      className={`group relative bg-[#ffffff] dark:bg-[#1f1e1d] border rounded-xl p-3.5 sm:p-4 transition-all ${
        isDone
          ? 'border-[#e2ded5]/60 dark:border-[#383530]/60 opacity-60 bg-[#f4f2ee]/40 dark:bg-[#282623]/40'
          : 'border-[#e2ded5] dark:border-[#383530] hover:border-[#b8b3a7] dark:hover:border-[#524d45] hover:shadow-xs'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Left: Complete toggle & content */}
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <button
            onClick={() => onComplete(item)}
            className="mt-0.5 text-[#6b6760] hover:text-[#2d553c] dark:hover:text-[#5b8a6c] transition-colors cursor-pointer shrink-0 focus:outline-none"
            title={isDone ? 'Completed' : 'Mark as done'}
            aria-label={isDone ? 'Mark as not done' : 'Mark as done'}
          >
            {isDone ? (
              <CheckCircle2 className="w-5 h-5 text-[#2d553c] dark:text-[#5b8a6c]" />
            ) : (
              <Circle className="w-5 h-5 hover:scale-105 transition-transform" />
            )}
          </button>

          <div className="flex-1 min-w-0">
            <p
              className={`text-[#1f1e1d] dark:text-[#ebe8e2] font-medium text-sm sm:text-base break-words leading-snug ${
                isDone ? 'line-through text-[#6b6760] dark:text-[#9e998f]' : ''
              }`}
            >
              {item.raw_text}
            </p>

            {/* Badges / metadata */}
            <div className="flex flex-wrap items-center gap-1.5 mt-2.5 text-xs">
              {item.category ? (
                <Badge variant={item.category}>
                  {item.category}
                </Badge>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-[#f4f2ee] dark:bg-[#282623] text-[#6b6760] dark:text-[#9e998f] border border-[#e2ded5] dark:border-[#383530]">
                  Categorizing...
                </span>
              )}

              {item.priority && (
                <Badge variant={item.priority >= 4 ? 'priority-high' : 'priority-mid'}>
                  P{item.priority}
                </Badge>
              )}

              {item.est_duration_min && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] bg-[#f4f2ee] dark:bg-[#282623] text-[#6b6760] dark:text-[#9e998f]">
                  <Clock className="w-3 h-3 text-[#6b6760]" />
                  {item.est_duration_min}m
                </span>
              )}

              {item.deadline && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] bg-[#7d3b2b]/10 text-[#7d3b2b] dark:text-[#d48372]">
                  <Calendar className="w-3 h-3" />
                  {formatDeadline(item.deadline)}
                </span>
              )}

              {item.topic_tag && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] bg-[#f4f2ee] dark:bg-[#282623] text-[#6b6760] dark:text-[#9e998f]">
                  <Tag className="w-3 h-3 opacity-60" />
                  #{item.topic_tag}
                </span>
              )}

              {item.status && item.status !== 'inbox' && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider bg-[#f4f2ee] dark:bg-[#282623] text-[#6b6760] dark:text-[#9e998f] border border-[#e2ded5] dark:border-[#383530]">
                  {item.status}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Contextual menu */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onEdit(item)}
            className="p-1 rounded-lg text-[#6b6760] hover:text-[#1f1e1d] dark:hover:text-[#ebe8e2] hover:bg-[#f4f2ee] dark:hover:bg-[#282623] transition-colors cursor-pointer"
            title="Edit item"
            aria-label="Edit item"
          >
            <Edit3 className="w-4 h-4" />
          </button>
          <DropdownMenu
            trigger={
              <button
                type="button"
                className="p-1 rounded-lg text-[#6b6760] hover:text-[#1f1e1d] dark:hover:text-[#ebe8e2] hover:bg-[#f4f2ee] dark:hover:bg-[#282623] transition-colors cursor-pointer"
                title="More actions"
                aria-label="More actions"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
            }
            items={menuItems}
          />
        </div>
      </div>
    </div>
  );
}
