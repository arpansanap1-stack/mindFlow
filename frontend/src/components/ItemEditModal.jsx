import React, { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import Modal from './ui/Modal';
import Button from './ui/Button';
import { formatDeadline12 } from '../utils/timeFormat';


export default function ItemEditModal({ item, isOpen, onClose, onSave }) {
  const [rawText, setRawText] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('');
  const [estDurationMin, setEstDurationMin] = useState('');
  const [deadline, setDeadline] = useState('');
  const [topicTag, setTopicTag] = useState('');
  const [status, setStatus] = useState('inbox');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (item) {
      setRawText(item.raw_text || '');
      setCategory(item.category || '');
      setPriority(item.priority !== null && item.priority !== undefined ? String(item.priority) : '');
      setEstDurationMin(item.est_duration_min ? String(item.est_duration_min) : '');
      if (item.deadline) {
        const d = new Date(item.deadline);
        const isoLocal = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
          .toISOString()
          .slice(0, 16);
        setDeadline(isoLocal);
      } else {
        setDeadline('');
      }
      setTopicTag(item.topic_tag || '');
      setStatus(item.status || 'inbox');
    }
  }, [item]);

  if (!isOpen || !item) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!rawText.trim()) return;

    setSaving(true);
    try {
      const payload = {
        raw_text: rawText.trim(),
        category: category || null,
        priority: priority ? parseInt(priority, 10) : null,
        est_duration_min: estDurationMin ? parseInt(estDurationMin, 10) : null,
        deadline: deadline ? new Date(deadline).toISOString() : null,
        topic_tag: topicTag.trim() || null,
        status: status || 'inbox',
      };
      await onSave(item.id, payload);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Item Details"
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div>
          <label className="block font-medium text-[#1f1e1d] dark:text-[#ebe8e2] mb-1">
            Task / Thought Description
          </label>
          <textarea
            rows={3}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            required
            className="w-full px-3 py-2 text-xs bg-[#ffffff] dark:bg-[#1f1e1d] border border-[#e2ded5] dark:border-[#383530] rounded-lg text-[#1f1e1d] dark:text-[#ebe8e2] focus:outline-none focus:ring-1 focus:ring-[#2d553c]"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-medium text-[#1f1e1d] dark:text-[#ebe8e2] mb-1">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[#ffffff] dark:bg-[#1f1e1d] border border-[#e2ded5] dark:border-[#383530] rounded-lg text-[#1f1e1d] dark:text-[#ebe8e2] focus:outline-none focus:ring-1 focus:ring-[#2d553c]"
            >
              <option value="">None / Inferred</option>
              <option value="task">Task</option>
              <option value="idea">Idea</option>
              <option value="reminder">Reminder</option>
              <option value="deadline">Deadline</option>
            </select>
          </div>

          <div>
            <label className="block font-medium text-[#1f1e1d] dark:text-[#ebe8e2] mb-1">
              Priority
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[#ffffff] dark:bg-[#1f1e1d] border border-[#e2ded5] dark:border-[#383530] rounded-lg text-[#1f1e1d] dark:text-[#ebe8e2] focus:outline-none focus:ring-1 focus:ring-[#2d553c]"
            >
              <option value="">None</option>
              <option value="1">1 - Lowest</option>
              <option value="2">2 - Low</option>
              <option value="3">3 - Medium</option>
              <option value="4">4 - High</option>
              <option value="5">5 - Critical</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-medium text-[#1f1e1d] dark:text-[#ebe8e2] mb-1">
              Est. Duration (min)
            </label>
            <input
              type="number"
              min="1"
              placeholder="e.g. 30"
              value={estDurationMin}
              onChange={(e) => setEstDurationMin(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[#ffffff] dark:bg-[#1f1e1d] border border-[#e2ded5] dark:border-[#383530] rounded-lg text-[#1f1e1d] dark:text-[#ebe8e2] focus:outline-none focus:ring-1 focus:ring-[#2d553c]"
            />
          </div>

          <div>
            <label className="block font-medium text-[#1f1e1d] dark:text-[#ebe8e2] mb-1">
              Topic Tag
            </label>
            <input
              type="text"
              placeholder="e.g. exams, math, personal"
              value={topicTag}
              onChange={(e) => setTopicTag(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[#ffffff] dark:bg-[#1f1e1d] border border-[#e2ded5] dark:border-[#383530] rounded-lg text-[#1f1e1d] dark:text-[#ebe8e2] focus:outline-none focus:ring-1 focus:ring-[#2d553c]"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-medium text-[#1f1e1d] dark:text-[#ebe8e2] mb-1">
              Deadline
            </label>
            <input
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[#ffffff] dark:bg-[#1f1e1d] border border-[#e2ded5] dark:border-[#383530] rounded-lg text-[#1f1e1d] dark:text-[#ebe8e2] focus:outline-none focus:ring-1 focus:ring-[#2d553c]"
            />
            {deadline && (
              <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium mt-1">
                Preview: {formatDeadline12(deadline)}
              </p>
            )}
          </div>


          <div>
            <label className="block font-medium text-[#1f1e1d] dark:text-[#ebe8e2] mb-1">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[#ffffff] dark:bg-[#1f1e1d] border border-[#e2ded5] dark:border-[#383530] rounded-lg text-[#1f1e1d] dark:text-[#ebe8e2] focus:outline-none focus:ring-1 focus:ring-[#2d553c]"
            >
              <option value="inbox">Inbox</option>
              <option value="scheduled">Scheduled</option>
              <option value="done">Done</option>
              <option value="skipped">Skipped</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#e2ded5] dark:border-[#383530]">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={saving || !rawText.trim()}
          >
            <Save className="w-3.5 h-3.5 mr-1" />
            <span>{saving ? 'Saving...' : 'Save Changes'}</span>
          </Button>
        </div>
      </form>
    </Modal>
  );
}
