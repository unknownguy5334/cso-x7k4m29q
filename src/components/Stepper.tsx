import React from 'react';
import { Check } from 'lucide-react';
import { AppStep } from '../types';

interface StepperProps {
  currentStep: AppStep;
  completedSteps: Record<AppStep, boolean>;
  onStepClick: (step: AppStep) => void;
  canNavigateTo: (step: AppStep) => boolean;
}

const STEPS: { id: AppStep; label: string; subtitle: string; number: number }[] = [
  { id: 'add', label: '1. Add Courses', subtitle: 'Paste or upload classes', number: 1 },
  { id: 'review', label: '2. Review & Verify', subtitle: 'Check credits and sections', number: 2 },
  { id: 'preferences', label: '3. Set Preferences', subtitle: 'Target credits and times', number: 3 },
  { id: 'results', label: '4. View Schedules', subtitle: 'Ranked valid options', number: 4 },
];

export const Stepper: React.FC<StepperProps> = ({
  currentStep,
  completedSteps,
  onStepClick,
  canNavigateTo,
}) => {
  const currentStepIndex = STEPS.findIndex((s) => s.id === currentStep);
  const activeStepObj = STEPS[currentStepIndex] || STEPS[0];

  return (
    <div className="w-full bg-white border-b border-neutral-200 py-3 sm:py-4">
      <div className="max-w-6xl mx-auto px-6 sm:px-8">
        {/* Mobile View */}
        <div className="sm:hidden flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="font-serif text-base font-semibold text-black">
              {activeStepObj.label}
            </span>
            <span className="text-[11px] font-mono-code text-neutral-500">
              Step {activeStepObj.number} of 4
            </span>
          </div>
          <div className="w-full bg-neutral-100 h-1 rounded-full overflow-hidden">
            <div
              className="bg-black h-full transition-all duration-300"
              style={{ width: `${((currentStepIndex + 1) / STEPS.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Desktop View: Clean Editorial Steps */}
        <div className="hidden sm:grid sm:grid-cols-4 gap-3 max-w-5xl mx-auto">
          {STEPS.map((step, idx) => {
            const isCurrent = currentStep === step.id;
            const isCompleted = completedSteps[step.id] || idx < currentStepIndex;
            const isClickable = canNavigateTo(step.id);

            return (
              <button
                key={step.id}
                type="button"
                disabled={!isClickable && !isCurrent}
                onClick={() => (isClickable || isCurrent) && onStepClick(step.id)}
                className={`flex items-center gap-3 p-2.5 rounded-xl transition-all text-left ${
                  isCurrent
                    ? 'bg-neutral-50 border border-neutral-900 shadow-2xs'
                    : isCompleted
                    ? 'hover:bg-neutral-50 cursor-pointer opacity-90 border border-transparent'
                    : 'opacity-40 cursor-not-allowed border border-transparent'
                }`}
              >
                {/* Step Circle Indicator */}
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 transition-all ${
                    isCurrent
                      ? 'bg-black text-white'
                      : isCompleted
                      ? 'bg-neutral-200 text-black'
                      : 'bg-neutral-100 text-neutral-400'
                  }`}
                >
                  {isCompleted && !isCurrent ? (
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  ) : (
                    <span className="font-serif text-xs font-bold">{step.number}</span>
                  )}
                </div>

                {/* Step Text Info */}
                <div className="flex flex-col min-w-0">
                  <span
                    className={`text-xs uppercase tracking-wider truncate ${
                      isCurrent
                        ? 'font-bold text-black'
                        : isCompleted
                        ? 'font-medium text-neutral-800'
                        : 'font-normal text-neutral-400'
                    }`}
                  >
                    {step.label.replace(/^\d+\.\s*/, '')}
                  </span>
                  <span className="text-[10px] text-neutral-500 truncate">
                    {step.subtitle}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

