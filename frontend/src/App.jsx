import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import CaptureBar from './components/CaptureBar';
import SmartInbox from './components/SmartInbox';
import RoutineProfile from './components/RoutineProfile';
import TimelineView from './components/TimelineView';
import ItemEditModal from './components/ItemEditModal';
import CompleteModal from './components/CompleteModal';
import NowSuggestionWidget from './components/NowSuggestionWidget';
import {
  fetchItems,
  createItem,
  updateItem,
  deleteItem,
  completeItem,
  checkHealth,
} from './api/items';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('inbox'); // 'inbox', 'schedule', 'routine'
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('inbox');
  const [isOnline, setIsOnline] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [completingItem, setCompletingItem] = useState(null);
  const [toast, setToast] = useState(null);
  const [suggestionRefreshKey, setSuggestionRefreshKey] = useState(0);

  const triggerSuggestionRefresh = () => setSuggestionRefreshKey((k) => k + 1);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 3500);
  };

  // Check backend health
  const checkStatus = useCallback(async () => {
    try {
      const ok = await checkHealth();
      setIsOnline(ok);
    } catch {
      setIsOnline(false);
    }
  }, []);

  // Fetch items from backend
  const loadItems = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchItems(statusFilter);
      setItems(data);
      setIsOnline(true);
    } catch (err) {
      console.error('Error fetching items:', err);
      setIsOnline(false);
      showToast(err.message || 'Failed to connect to backend', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    checkStatus();
    loadItems();
    const interval = setInterval(checkStatus, 15000);
    return () => clearInterval(interval);
  }, [checkStatus, loadItems]);

  // Auto-refresh in place when an item is in "classifying..." state (SPEC 1.5)
  useEffect(() => {
    const hasUnclassified = items.some(
      (i) => i.category === null && i.status === 'inbox'
    );
    if (!hasUnclassified) return;

    const timer = setTimeout(async () => {
      try {
        const data = await fetchItems(statusFilter);
        setItems(data);
      } catch (err) {
        console.error('Failed to auto-refresh classifying items:', err);
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [items, statusFilter]);

  // Capture item (with auto-classification from Step 3)
  const handleCapture = async (rawText) => {
    try {
      const newItem = await createItem(rawText);
      // Prepend to items list if viewing inbox or all
      if (statusFilter === 'inbox' || statusFilter === null) {
        setItems((prev) => [newItem, ...prev]);
      }
      triggerSuggestionRefresh();
      showToast('Item captured to inbox!');
    } catch (err) {
      showToast(err.message || 'Failed to capture item', 'error');
      throw err;
    }
  };

  // Complete item prompt
  const handlePromptComplete = (item) => {
    if (item.status === 'done') {
      // Toggle back to inbox if already done
      handleUpdateItem(item.id, { status: 'inbox' });
    } else {
      setCompletingItem(item);
    }
  };

  // Confirm complete
  const handleConfirmComplete = async (itemId, actualDuration) => {
    try {
      const updated = await completeItem(itemId, actualDuration);
      if (statusFilter === 'inbox') {
        setItems((prev) => prev.filter((i) => i.id !== itemId));
      } else {
        setItems((prev) => prev.map((i) => (i.id === itemId ? updated : i)));
      }
      triggerSuggestionRefresh();
      showToast('Item completed!');
    } catch (err) {
      showToast(err.message || 'Failed to complete item', 'error');
    }
  };

  // Update item
  const handleUpdateItem = async (itemId, updates) => {
    try {
      const updated = await updateItem(itemId, updates);
      setItems((prev) => {
        if (statusFilter === 'inbox' && updated.status !== 'inbox') {
          return prev.filter((i) => i.id !== itemId);
        }
        return prev.map((i) => (i.id === itemId ? updated : i));
      });
      triggerSuggestionRefresh();
      showToast('Item updated');
    } catch (err) {
      showToast(err.message || 'Failed to update item', 'error');
    }
  };

  // Delete item
  const handleDeleteItem = async (itemId) => {
    if (!window.confirm('Delete this item?')) return;
    try {
      await deleteItem(itemId);
      setItems((prev) => prev.filter((i) => i.id !== itemId));
      triggerSuggestionRefresh();
      showToast('Item deleted');
    } catch (err) {
      showToast(err.message || 'Failed to delete item', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      <Header
        isOnline={isOnline}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 space-y-6">
        {/* Prominent "What should I do now?" Banner / Widget (SPEC 1.8 & 1.9 Step 8) */}
        <section aria-label="What should I do now? Area">
          <NowSuggestionWidget
            onCompleteItem={handlePromptComplete}
            onToast={showToast}
            refreshTrigger={suggestionRefreshKey}
          />
        </section>

        {activeTab === 'inbox' && (
          <>

            {/* Capture Bar (Feature 1) */}
            <section aria-label="Quick Capture Area">
              <CaptureBar onCapture={handleCapture} isLoading={isLoading} />
            </section>

            {/* Smart Inbox (Feature 3) */}
            <section aria-label="Smart Inbox Area">
              <SmartInbox
                items={items}
                isLoading={isLoading}
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
                onCompleteItem={handlePromptComplete}
                onEditItem={(item) => setEditingItem(item)}
                onDeleteItem={handleDeleteItem}
              />
            </section>
          </>
        )}

        {activeTab === 'schedule' && (
          <section aria-label="Day Schedule Area">
            <TimelineView
              onCompleteItem={handlePromptComplete}
              onToast={showToast}
            />
          </section>
        )}

        {activeTab === 'routine' && (
          <section aria-label="Routine Profile Area">
            <RoutineProfile onToast={showToast} />
          </section>
        )}
      </main>

      {/* Item Edit Modal */}
      <ItemEditModal
        item={editingItem}
        isOpen={Boolean(editingItem)}
        onClose={() => setEditingItem(null)}
        onSave={handleUpdateItem}
      />

      {/* Complete with Feedback Modal */}
      <CompleteModal
        item={completingItem}
        isOpen={Boolean(completingItem)}
        onClose={() => setCompletingItem(null)}
        onConfirm={handleConfirmComplete}
      />

      {/* Toast feedback */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div
            className={`flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium ${
              toast.type === 'error'
                ? 'bg-red-50 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-200 dark:border-red-900'
                : 'bg-slate-900 text-white border-slate-800 dark:bg-white dark:text-slate-900 dark:border-slate-200'
            }`}
          >
            {toast.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-red-500" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
            )}
            <span>{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="ml-2 opacity-60 hover:opacity-100 p-0.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
