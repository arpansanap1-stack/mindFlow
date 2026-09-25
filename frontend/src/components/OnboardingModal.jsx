import React, { useState } from 'react';
import { ArrowRight, Check, Clock, Calendar, CheckCircle2 } from 'lucide-react';
import Modal from './ui/Modal';
import Button from './ui/Button';

export default function OnboardingModal({ isOpen, onClose, onQuickCreate }) {
  const [step, setStep] = useState(1);
  const [studyHours, setStudyHours] = useState('09:00 - 18:00');
  const [sampleInput, setSampleInput] = useState('Finish DBMS assignment by tomorrow 5pm ~45min');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdSample, setCreatedSample] = useState(false);

  const handleCompleteFirstTask = async () => {
    if (!sampleInput.trim()) return;
    setIsSubmitting(true);
    try {
      if (onQuickCreate) {
        await onQuickCreate(sampleInput);
      }
      setCreatedSample(true);
      setTimeout(() => {
        handleFinish();
      }, 1400);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinish = () => {
    try {
      localStorage.setItem('mindflow_onboarded', 'true');
    } catch {
      // ignore
    }
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleFinish}
      title={
        step === 1
          ? 'Welcome to MindFlow'
          : step === 2
          ? 'Set your daily pacing'
          : 'Capture your first thought'
      }
      maxWidth="max-w-md"
    >
      <div className="space-y-5">
        {/* Step indicator */}
        <div className="flex items-center justify-between pb-2 border-b border-[#e2ded5] dark:border-[#383530]">
          <span className="text-xs font-medium text-[#6b6760] dark:text-[#9e998f]">
            Step {step} of 3
          </span>
          <div className="flex items-center gap-1.5">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all ${
                  s === step
                    ? 'w-6 bg-[#2d553c] dark:bg-[#5b8a6c]'
                    : s < step
                    ? 'w-2 bg-[#2d553c]/40'
                    : 'w-2 bg-[#e2ded5] dark:bg-[#383530]'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Step 1: Concept & Promise */}
        {step === 1 && (
          <div className="space-y-4 text-sm text-[#3b3834] dark:text-[#d3cebe]">
            <div className="p-4 rounded-xl bg-[#f4f2ee] dark:bg-[#282623] border border-[#e2ded5] dark:border-[#383530]">
              <p className="font-medium text-[#1f1e1d] dark:text-[#ebe8e2] mb-1">
                A calm workspace for student life
              </p>
              <p className="text-xs text-[#6b6760] dark:text-[#9e998f] leading-relaxed">
                Dump messy thoughts, project ideas, deadlines, and study tasks naturally. MindFlow organizes them into an adaptive daily plan without requiring micro-management.
              </p>
            </div>

            <div className="space-y-2 text-xs text-[#6b6760] dark:text-[#9e998f]">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#2d553c] dark:text-[#5b8a6c] shrink-0" />
                <span>Zero-friction brain dump in natural language</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#2d553c] dark:text-[#5b8a6c] shrink-0" />
                <span>Automatic categorization & priority estimation</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#2d553c] dark:text-[#5b8a6c] shrink-0" />
                <span>One clear "Next Up" task to protect your focus</span>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <Button variant="primary" onClick={() => setStep(2)}>
                <span>Continue</span>
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Minimum settings */}
        {step === 2 && (
          <div className="space-y-4 text-sm">
            <p className="text-xs text-[#6b6760] dark:text-[#9e998f]">
              When do you usually study or get deep work done? You can fine-tune your full weekly routine later in the Routine tab.
            </p>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-[#1f1e1d] dark:text-[#ebe8e2]">
                Typical active window
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  '08:00 - 16:00 (Early)',
                  '09:00 - 18:00 (Standard)',
                  '12:00 - 20:00 (Afternoon)',
                  '18:00 - 02:00 (Night Owl)',
                ].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setStudyHours(preset)}
                    className={`p-2.5 rounded-lg border text-left text-xs transition-colors cursor-pointer ${
                      studyHours === preset
                        ? 'border-[#2d553c] bg-[#2d553c]/5 text-[#2d553c] dark:border-[#5b8a6c] dark:bg-[#5b8a6c]/10 dark:text-[#ebe8e2] font-semibold'
                        : 'border-[#e2ded5] dark:border-[#383530] text-[#6b6760] dark:text-[#9e998f] hover:border-[#b8b3a7]'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between">
              <Button variant="ghost" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button variant="primary" onClick={() => setStep(3)}>
                <span>Next: Try Capture</span>
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Capture first task */}
        {step === 3 && (
          <div className="space-y-4 text-sm">
            <p className="text-xs text-[#6b6760] dark:text-[#9e998f]">
              Write anything naturally. Notice how MindFlow detects what needs doing, estimated time, and deadline.
            </p>

            <div className="space-y-2">
              <textarea
                value={sampleInput}
                onChange={(e) => setSampleInput(e.target.value)}
                rows={2}
                placeholder="e.g. Read Operating Systems Chapter 4 tonight ~30min"
                className="w-full px-3 py-2 rounded-lg border border-[#e2ded5] dark:border-[#383530] bg-[#fbfaf8] dark:bg-[#1f1e1d] text-[#1f1e1d] dark:text-[#ebe8e2] text-xs focus:outline-none focus:ring-1 focus:ring-[#2d553c]"
              />

              <div className="p-3 rounded-lg bg-[#f4f2ee] dark:bg-[#282623] border border-[#e2ded5] dark:border-[#383530] space-y-1.5">
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#6b6760] dark:text-[#9e998f]">
                  MindFlow Preview
                </span>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-semibold text-[#1f1e1d] dark:text-[#ebe8e2]">
                    Finish DBMS assignment
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] text-[#6b6760] dark:text-[#9e998f]">
                    <Clock className="w-3 h-3" /> ~45 min
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] text-[#7d3b2b] dark:text-[#d48372]">
                    <Calendar className="w-3 h-3" /> Due tomorrow 5pm
                  </span>
                </div>
              </div>
            </div>

            {createdSample ? (
              <div className="p-3 rounded-lg bg-[#2d553c]/10 text-[#2d553c] dark:text-[#5b8a6c] flex items-center gap-2 text-xs font-medium">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Added to your workspace! Opening Today...</span>
              </div>
            ) : (
              <div className="pt-2 flex items-center justify-between">
                <Button variant="ghost" onClick={() => setStep(2)}>
                  Back
                </Button>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={handleFinish}>
                    Skip
                  </Button>
                  <Button
                    variant="primary"
                    disabled={isSubmitting}
                    onClick={handleCompleteFirstTask}
                  >
                    {isSubmitting ? 'Adding...' : 'Add to MindFlow'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
