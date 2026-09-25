import React, { useState } from 'react';
import { Lock, Mail, AlertCircle, ArrowRight, Loader2, Leaf } from 'lucide-react';
import { login } from '../api/auth';
import Button from './ui/Button';

export default function LoginPage({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Please provide both email and password.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const data = await login(email.trim(), password);
      onLoginSuccess(data.user);
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#fbfaf8] dark:bg-[#1a1918] p-4 transition-colors">
      <div className="w-full max-w-sm">
        {/* Branding header */}
        <div className="text-center mb-6">
          <div className="inline-flex w-10 h-10 rounded-xl bg-[#2d553c] text-white items-center justify-center shadow-xs mb-2.5">
            <Leaf className="w-5 h-5" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-[#1f1e1d] dark:text-[#ebe8e2]">
            MindFlow
          </h1>
          <p className="text-xs text-[#6b6760] dark:text-[#9e998f] mt-0.5">
            A calm workspace for student tasks & thoughts
          </p>
        </div>

        {/* Card */}
        <div className="bg-[#ffffff] dark:bg-[#1f1e1d] border border-[#e2ded5] dark:border-[#383530] rounded-xl p-6 shadow-xs">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-[#7d3b2b]/10 border border-[#7d3b2b]/20 flex items-start gap-2 text-xs text-[#7d3b2b] dark:text-[#d48372]">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email-input"
                className="block text-xs font-medium text-[#1f1e1d] dark:text-[#ebe8e2] mb-1.5"
              >
                Email or Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#9e998f]">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  id="email-input"
                  type="text"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-[#e2ded5] dark:border-[#383530] bg-[#fbfaf8] dark:bg-[#1a1918] text-[#1f1e1d] dark:text-[#ebe8e2] focus:outline-none focus:ring-1 focus:ring-[#2d553c] placeholder:text-[#9e998f]"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password-input"
                className="block text-xs font-medium text-[#1f1e1d] dark:text-[#ebe8e2] mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#9e998f]">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="password-input"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-[#e2ded5] dark:border-[#383530] bg-[#fbfaf8] dark:bg-[#1a1918] text-[#1f1e1d] dark:text-[#ebe8e2] focus:outline-none focus:ring-1 focus:ring-[#2d553c] placeholder:text-[#9e998f]"
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              disabled={isLoading}
              className="w-full justify-center mt-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4 ml-1.5" />
                </>
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
