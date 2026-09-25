import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import TodayView from './components/TodayView';
import CaptureBar from './components/CaptureBar';
import SmartInbox from './components/SmartInbox';
import RoutineProfile from './components/RoutineProfile';
import TimelineView from './components/TimelineView';
import ItemEditModal from './components/ItemEditModal';
import CompleteModal from './components/CompleteModal';
import OnboardingModal from './components/OnboardingModal';
import MobileNav from './components/MobileNav';
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
  const [activeTab, setActiveTab] = useState('today'); // 'today', 'inbox', 'schedule', 'routine', 'admin'
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('inbox');
  const [isOnline, setIsOnline] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [completingItem, setCompletingItem] = useState(null);
  const [toast, setToast] = useState(null);
  const [suggestionRefreshKey, setSuggestionRefreshKey] = useState(0);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);

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
        const hasOnboarded = localStorage.getItem('mindflow_onboarded');
        if (!hasOnboarded) {
          setIsOnboardingOpen(true);
        }
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

  // Auto-refresh in place when an item is in "classifying..." state
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
    setActiveTab('today');
    showToast(`Welcome back, ${user.email}!`);
    const hasOnboarded = localStorage.getItem('mindflow_onboarded');
    if (!hasOnboarded) {
      setIsOnboardingOpen(true);
    }
  };

  // Handle Sign Out
  const handleLogout = async () => {
    await logout();
    setCurrentUser(null);
    setItems([]);
    setActiveTab('today');
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
      showToast('Item captured to workspace');
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
      <div className="min-h-screen flex items-center justify-center bg-[#fbfaf8] dark:bg-[#1a1918] text-[#6b6760]">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-[#2d553c] dark:text-[#5b8a6c]" />
          <span className="text-xs font-medium">Opening MindFlow...</span>
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
          <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-3 duration-150">
            <div
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-lg shadow-sm border text-xs font-medium ${
                toast.type === 'error'
                  ? 'bg-[#7d3b2b]/10 text-[#7d3b2b] border-[#7d3b2b]/30'
                  : 'bg-[#ffffff] dark:bg-[#1f1e1d] text-[#1f1e1d] dark:text-[#ebe8e2] border-[#e2ded5] dark:border-[#383530]'
              }`}
            >
              {toast.type === 'error' ? (
                <AlertCircle className="w-4 h-4 text-[#7d3b2b]" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-[#2d553c]" />
              )}
              <span>{toast.message}</span>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#fbfaf8] dark:bg-[#1a1918] text-[#1f1e1d] dark:text-[#ebe8e2] flex flex-col font-sans transition-colors duration-150 pb-16 sm:pb-0">
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
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6 sm:py-8 space-y-6">
        {activeTab === 'admin' && currentUser.role === 'ADMIN' ? (
          <section aria-label="Administrator Dashboard">
            <AdminDashboard currentUser={currentUser} onToast={showToast} />
          </section>
        ) : (
          <>
            {/* Primary Experience: Today */}
            {activeTab === 'today' && (
              <section aria-label="Today Workspace">
                <TodayView
                  items={items}
                  currentUser={currentUser}
                  onCompleteItem={handlePromptComplete}
                  onCapture={handleCapture}
                  onToast={showToast}
                  suggestionRefreshKey={suggestionRefreshKey}
                  onNavigateTab={(tab) => setActiveTab(tab)}
                />
              </section>
            )}

            {/* Smart Inbox Tab */}
            {activeTab === 'inbox' && (
              <div className="space-y-6">
                <section aria-label="Quick Capture Area">
                  <CaptureBar onCapture={handleCapture} isLoading={isLoading} />
                </section>

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
              </div>
            )}

            {/* Day Plan (Schedule) Tab */}
            {activeTab === 'schedule' && (
              <section aria-label="Day Schedule Area">
                <TimelineView
                  onCompleteItem={handlePromptComplete}
                  onToast={showToast}
                />
              </section>
            )}

            {/* Routine Calibration Tab */}
            {activeTab === 'routine' && (
              <section aria-label="Routine Profile Area">
                <RoutineProfile onToast={showToast} />
              </section>
            )}
          </>
        )}
      </main>

      {/* Responsive Mobile Bottom Navigation */}
      <MobileNav
        activeTab={activeTab}
        onSelectTab={(tab) => {
          if (tab === 'admin' && currentUser.role !== 'ADMIN') return;
          setActiveTab(tab);
        }}
        onOpenQuickAdd={() => {
          setActiveTab('inbox');
          setTimeout(() => {
            const el = document.getElementById('capture-input');
            el?.focus();
          }, 100);
        }}
        currentUser={currentUser}
      />

      {/* First-Time Gentle Onboarding Modal */}
      <OnboardingModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        onQuickCreate={handleCapture}
      />

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

      {/* Mandatory Password Change Modal */}
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

      {/* Toast notification feedback */}
      {toast && (
        <div className="fixed bottom-16 sm:bottom-6 right-4 sm:right-6 z-50 animate-in fade-in slide-in-from-bottom-3 duration-150">
          <div
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-lg shadow-sm border text-xs font-medium ${
              toast.type === 'error'
                ? 'bg-[#7d3b2b]/10 text-[#7d3b2b] border-[#7d3b2b]/30'
                : 'bg-[#ffffff] dark:bg-[#1f1e1d] text-[#1f1e1d] dark:text-[#ebe8e2] border-[#e2ded5] dark:border-[#383530]'
            }`}
          >
            {toast.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-[#7d3b2b] shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-[#2d553c] dark:text-[#5b8a6c] shrink-0" />
            )}
            <span>{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="ml-2 text-[#6b6760] hover:text-[#1f1e1d] dark:hover:text-[#ebe8e2] cursor-pointer"
              aria-label="Dismiss toast"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
