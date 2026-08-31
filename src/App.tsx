/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AppStep, OptimizerOutput, SchedulePreferences, Section } from './types';
import { Header } from './components/Header';
import { Stepper } from './components/Stepper';
import { StepAddCourses } from './components/StepAddCourses';
import { StepReview } from './components/StepReview';
import { StepPreferences } from './components/StepPreferences';
import { StepResults } from './components/StepResults';
import { runOptimizer } from './utils/optimizer';

const STORAGE_KEY_SECTIONS = 'register_course_sections_v4';
const STORAGE_KEY_PREFS = 'register_schedule_preferences_v4';

const DEFAULT_PREFERENCES: SchedulePreferences = {
  targetCredits: 17,
  useCreditRange: false,
  minCredits: 14,
  maxCredits: 17,
  mandatoryCourses: [],
  lockedSectionIds: {},
  earliestStartTime: 'ANY',
  latestEndTime: 'ANY',
  freeDays: [],
  maxDays: 5,
};

export default function App() {
  // Enforce pure white luxury editorial theme throughout
  useEffect(() => {
    document.documentElement.classList.remove('dark');
  }, []);

  // Current Step state
  const [currentStep, setCurrentStep] = useState<AppStep>('add');

  // Course sections catalog state - starts clean and empty
  const [sections, setSections] = useState<Section[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SECTIONS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  // Schedule Preferences State (Capped at 17 max credits)
  const [preferences, setPreferences] = useState<SchedulePreferences>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PREFS);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...DEFAULT_PREFERENCES,
          ...parsed,
          targetCredits: Math.min(17, parsed.targetCredits || 17),
          maxCredits: Math.min(17, parsed.maxCredits || 17),
        };
      }
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_PREFERENCES;
  });

  // Completed steps tracking
  const [completedSteps, setCompletedSteps] = useState<Record<AppStep, boolean>>({
    add: false,
    review: false,
    preferences: false,
    results: false,
  });

  // Optimizer output state
  const [optimizerOutput, setOptimizerOutput] = useState<OptimizerOutput | null>(null);

  // Sync state to local storage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SECTIONS, JSON.stringify(sections));
    } catch (e) {
      console.error(e);
    }
  }, [sections]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_PREFS, JSON.stringify(preferences));
    } catch (e) {
      console.error(e);
    }
  }, [preferences]);

  // Section additions & merge handler
  const handleAddSections = (newSections: Section[]) => {
    setSections((prev) => {
      const existingIds = new Set(prev.map((s) => s.id));
      const filteredNew = newSections.filter((s) => !existingIds.has(s.id));
      return [...prev, ...filteredNew];
    });
    setCompletedSteps((prev) => ({ ...prev, add: true }));
  };

  const handleClearSections = () => {
    setSections([]);
    setPreferences(DEFAULT_PREFERENCES);
    setOptimizerOutput(null);
    setCompletedSteps({
      add: false,
      review: false,
      preferences: false,
      results: false,
    });
    setCurrentStep('add');
  };

  // Run Optimization Algorithm with user preferences
  const executeOptimizer = (prefsToUse: SchedulePreferences) => {
    // Group sections by course
    const courseMap: Record<string, Section[]> = {};
    const fixedCoursesList: Section[] = [];

    for (const sec of sections) {
      const cName = sec.name.trim();
      const lockedId = prefsToUse.lockedSectionIds[cName];

      if (lockedId === sec.id) {
        fixedCoursesList.push(sec);
      } else if (!lockedId) {
        // Not locked to any specific section, so add to combinatorial search pool
        if (!courseMap[cName]) courseMap[cName] = [];
        courseMap[cName].push(sec);
      }
    }

    const output = runOptimizer({
      courses: courseMap,
      fixedCourses: fixedCoursesList,
      preferences: prefsToUse,
    });

    setOptimizerOutput(output);
    setCompletedSteps((prev) => ({
      ...prev,
      add: true,
      review: true,
      preferences: true,
      results: true,
    }));
    setCurrentStep('results');
  };

  const handleRunOptimizer = () => {
    executeOptimizer(preferences);
  };

  const handleAutoFixPreference = (updated: Partial<SchedulePreferences>) => {
    const newPrefs = { ...preferences, ...updated };
    setPreferences(newPrefs);
    executeOptimizer(newPrefs);
  };

  // Navigation conditions
  const canNavigateTo = (step: AppStep): boolean => {
    if (step === 'add') return true;
    if (step === 'review') return sections.length > 0;
    if (step === 'preferences') {
      return (
        sections.length > 0 &&
        sections.every((s) => s.credits !== null && !isNaN(s.credits) && s.credits > 0)
      );
    }
    if (step === 'results') return optimizerOutput !== null;
    return false;
  };

  return (
    <div className="min-h-screen flex flex-col bg-white text-black antialiased selection:bg-neutral-900 selection:text-white">
      {/* Header */}
      <Header
        totalCoursesCount={sections.length}
        onReset={handleClearSections}
      />

      {/* 4-Step Global Stepper */}
      <Stepper
        currentStep={currentStep}
        completedSteps={completedSteps}
        onStepClick={(step) => setCurrentStep(step)}
        canNavigateTo={canNavigateTo}
      />

      {/* Main Content Area */}
      <main className="flex-1 pb-16">
        {currentStep === 'add' && (
          <StepAddCourses
            sections={sections}
            onAddSections={handleAddSections}
            onClearSections={handleClearSections}
            onContinueToReview={() => {
              setCompletedSteps((prev) => ({ ...prev, add: true }));
              setCurrentStep('review');
            }}
          />
        )}

        {currentStep === 'review' && (
          <StepReview
            sections={sections}
            onUpdateSections={setSections}
            onBackToAdd={() => setCurrentStep('add')}
            onContinueToPreferences={() => {
              // Auto-align targetCredits to available catalog credits if currently exceeding
              const courseNames = new Set(sections.map((s) => s.name.trim()));
              let totalCatalog = 0;
              for (const name of courseNames) {
                const sampleSec = sections.find((s) => s.name.trim() === name);
                totalCatalog += sampleSec?.credits || 3;
              }
              if (totalCatalog > 0 && preferences.targetCredits > totalCatalog) {
                setPreferences((prev) => ({
                  ...prev,
                  targetCredits: Math.min(17, totalCatalog),
                }));
              }
              setCompletedSteps((prev) => ({ ...prev, add: true, review: true }));
              setCurrentStep('preferences');
            }}
          />
        )}

        {currentStep === 'preferences' && (
          <StepPreferences
            sections={sections}
            preferences={preferences}
            onUpdatePreferences={setPreferences}
            onBackToReview={() => setCurrentStep('review')}
            onRunOptimizer={handleRunOptimizer}
          />
        )}

        {currentStep === 'results' && optimizerOutput && (
          <StepResults
            optimizerOutput={optimizerOutput}
            targetCredits={preferences.targetCredits}
            onBackToPreferences={() => setCurrentStep('preferences')}
            onBackToAddCourses={() => setCurrentStep('add')}
            onAutoFixPreference={handleAutoFixPreference}
          />
        )}
      </main>
    </div>
  );
}
