import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import CaptureBar from './components/CaptureBar';
import SmartInbox from './components/SmartInbox';
import RoutineProfile from './components/RoutineProfile';
import TimelineView from './components/TimelineView';
import ItemEditModal from './components/ItemEditModal';
import CompleteModal from './components/CompleteModal';
import NowSuggestionWidget from './components/NowSuggestionWidget';
import LoginPage from './components/LoginPage';
import AdminDashboard from './components/AdminDashboard';
import ChangePasswordModal from './components/ChangePasswordModal';
import {
  fetchItems,
  createItem,
  updateItem,
  deleteItem,
  completeItem,
  checkHealth,
} from './api/items';
import {
  getToken,
  getMe,
  logout,
  onUnauthorized,
} from './api/auth';
import { AlertCircle, CheckCircle2, X, Loader2 } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [activeTab, setActiveTab] = useState('inbox'); // 'inbox', 'schedule', 'routine', 'admin'
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('inbox');
  const [isOnline, setIsOnline] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [completingItem, setCompletingItem] = useState(null);
  const [toast, setToast] = useState(null);
  const [suggestionRefreshKey, setSuggestionRefreshKey] = useState(0);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  const triggerSuggestionRefresh = () => setSuggestionRefreshKey((k) => k + 1);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 3500);
  }, []);

  // Listen to 401 unauthorized events from any API call
  useEffect(() => {
    const unsubscribe = onUnauthorized(() => {
      setCurrentUser(null);
      setItems([]);
      showToast('Session expired. Please sign in again.', 'error');
    });
    return unsubscribe;
  }, [showToast]);

  // Check auth status on mount
  useEffect(() => {
    const initAuth = async () => {
      const token = getToken();
      if (!token) {
        setIsAuthChecking(false);
        return;
      }
      try {
        const user = await getMe();
        setCurrentUser(user);
      } catch (err) {
        console.warn('Initial auth check failed:', err);
        setCurrentUser(null);
      } finally {
        setIsAuthChecking(false);
      }
    };
    initAuth();
  }, []);

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
    if (!currentUser) return;
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
  }, [currentUser, statusFilter, showToast]);

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 15000);
    return () => clearInterval(interval);
  }, [checkStatus]);

  useEffect(() => {
    if (currentUser) {
      loadItems();
    }
  }, [currentUser, loadItems]);

  // Auto-refresh in place when an item is in "classifying..." state (SPEC 1.5)
  useEffect(() => {
    if (!currentUser) return;
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
  }, [currentUser, items, statusFilter]);

  // Handle Login Success
  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    setActiveTab('inbox');
    showToast(`Welcome back, ${user.email}!`);
  };

  // Handle Sign Out
  const handleLogout = async () => {
    await logout();
    setCurrentUser(null);
    setItems([]);
    setActiveTab('inbox');
    showToast('Signed out successfully');
  };

  // Capture item (with auto-classification)
  const handleCapture = async (rawText) => {
    try {
      const newItem = await createItem(rawText);
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

  // Loading initial auth state
  if (isAuthChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-500">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
          <span className="text-xs font-medium">Loading MindFlow...</span>
        </div>
      </div>
    );
  }

  // Not logged in -> Render Login Page
  if (!currentUser) {
    return (
      <>
        <LoginPage onLoginSuccess={handleLoginSuccess} />
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
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      <Header
        isOnline={isOnline}
        activeTab={activeTab}
        onSelectTab={(tab) => {
          if (tab === 'admin' && currentUser.role !== 'ADMIN') return;
          setActiveTab(tab);
        }}
        currentUser={currentUser}
        onLogout={handleLogout}
        onChangePassword={() => setIsChangePasswordOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 space-y-6">
        {/* Admin Dashboard Tab */}
        {activeTab === 'admin' && currentUser.role === 'ADMIN' ? (
          <section aria-label="Administrator Dashboard">
            <AdminDashboard currentUser={currentUser} onToast={showToast} />
          </section>
        ) : (
          <>
            {/* Prominent "What should I do now?" Banner / Widget */}
            <section aria-label="What should I do now? Area">
              <NowSuggestionWidget
                onCompleteItem={handlePromptComplete}
                onToast={showToast}
                refreshTrigger={suggestionRefreshKey}
              />
            </section>

            {activeTab === 'inbox' && (
              <>
                {/* Capture Bar */}
                <section aria-label="Quick Capture Area">
                  <CaptureBar onCapture={handleCapture} isLoading={isLoading} />
                </section>

                {/* Smart Inbox */}
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
          </>
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

      {/* Mandatory Password Change Modal (on first login or after admin reset) */}
      <ChangePasswordModal
        isOpen={Boolean(currentUser?.must_change_password)}
        isMandatory={true}
        onSuccess={() => {
          setCurrentUser((prev) => ({ ...prev, must_change_password: false }));
          showToast('Password changed successfully! You may now proceed.');
        }}
      />

      {/* Voluntary Password Change Modal */}
      <ChangePasswordModal
        isOpen={isChangePasswordOpen && !currentUser?.must_change_password}
        isMandatory={false}
        onClose={() => setIsChangePasswordOpen(false)}
        onSuccess={() => {
          setIsChangePasswordOpen(false);
          showToast('Password updated successfully!');
        }}
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
