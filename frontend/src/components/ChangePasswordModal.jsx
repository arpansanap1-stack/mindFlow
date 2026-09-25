import React, { useState } from 'react';
import { Lock, AlertCircle, Loader2 } from 'lucide-react';
import { changePassword } from '../api/auth';
import Modal from './ui/Modal';
import Button from './ui/Button';

export default function ChangePasswordModal({
  isOpen,
  isMandatory = false,
  onClose,
  onSuccess,
}) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!currentPassword) {
      setError('Please enter your current password.');
      return;
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      if (onSuccess) onSuccess();
      if (onClose) onClose();
    } catch (err) {
      setError(err.message || 'Failed to change password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={isMandatory ? () => {} : onClose}
      title={isMandatory ? 'Set New Password' : 'Change Password'}
      maxWidth="max-w-md"
    >
      <div className="space-y-4 text-xs">
        <p className="text-[#6b6760] dark:text-[#9e998f]">
          {isMandatory
            ? 'Your account requires updating your password before continuing.'
            : 'Choose a strong password of at least 8 characters.'}
        </p>

        {error && (
          <div className="p-3 rounded-lg bg-[#7d3b2b]/10 border border-[#7d3b2b]/20 flex items-start gap-2 text-xs text-[#7d3b2b] dark:text-[#d48372]">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="leading-relaxed">{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block font-medium text-[#1f1e1d] dark:text-[#ebe8e2] mb-1">
              Current Password
            </label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2 text-xs rounded-lg border border-[#e2ded5] dark:border-[#383530] bg-[#ffffff] dark:bg-[#1f1e1d] text-[#1f1e1d] dark:text-[#ebe8e2] focus:outline-none focus:ring-1 focus:ring-[#2d553c]"
            />
          </div>

          <div>
            <label className="block font-medium text-[#1f1e1d] dark:text-[#ebe8e2] mb-1">
              New Password
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="w-full px-3 py-2 text-xs rounded-lg border border-[#e2ded5] dark:border-[#383530] bg-[#ffffff] dark:bg-[#1f1e1d] text-[#1f1e1d] dark:text-[#ebe8e2] focus:outline-none focus:ring-1 focus:ring-[#2d553c]"
            />
          </div>

          <div>
            <label className="block font-medium text-[#1f1e1d] dark:text-[#ebe8e2] mb-1">
              Confirm New Password
            </label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2 text-xs rounded-lg border border-[#e2ded5] dark:border-[#383530] bg-[#ffffff] dark:bg-[#1f1e1d] text-[#1f1e1d] dark:text-[#ebe8e2] focus:outline-none focus:ring-1 focus:ring-[#2d553c]"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#e2ded5] dark:border-[#383530]">
            {!isMandatory && onClose && (
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
            )}
            <Button
              type="submit"
              variant="primary"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                  <span>Updating...</span>
                </>
              ) : (
                <span>Update Password</span>
              )}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
