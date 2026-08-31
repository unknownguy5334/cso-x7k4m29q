import React, { useMemo } from 'react';
import {
  Lock,
  Unlock,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Clock,
  Calendar,
  CheckSquare,
  Square,
} from 'lucide-react';
import { CourseGroup, DayOfWeek, SchedulePreferences, Section } from '../types';
import { sessionsConflict } from '../utils/optimizer';
import { getCourseColor } from '../utils/colors';

interface StepPreferencesProps {
  sections: Section[];
  preferences: SchedulePreferences;
  onUpdatePreferences: (prefs: SchedulePreferences) => void;
  onBackToReview: () => void;
  onRunOptimizer: () => void;
}

const MAX_ALLOWED_CREDITS = 17;

export const StepPreferences: React.FC<StepPreferencesProps> = ({
  sections,
  preferences,
  onUpdatePreferences,
  onBackToReview,
  onRunOptimizer,
}) => {
  const {
    targetCredits,
    useCreditRange,
    minCredits,
    maxCredits,
    mandatoryCourses = [],
    lockedSectionIds,
    earliestStartTime,
    latestEndTime,
    freeDays = [],
  } = preferences;

  // Group sections by course name
  const courseGroups = useMemo<CourseGroup[]>(() => {
    const map = new Map<string, Section[]>();
    for (const sec of sections) {
      const trimmedName = sec.name.trim() || 'Untitled Course';
      if (!map.has(trimmedName)) {
        map.set(trimmedName, []);
      }
      map.get(trimmedName)!.push(sec);
    }
    return Array.from(map.entries()).map(([name, groupSections]) => ({
      name,
      sections: groupSections,
      colorIndex: groupSections[0]?.colorIndex,
    }));
  }, [sections]);

  // Compute currently locked section objects
  const lockedSectionsList = useMemo<Section[]>(() => {
    const list: Section[] = [];
    for (const [courseName, secId] of Object.entries(lockedSectionIds)) {
      if (secId) {
        const found = sections.find((s) => s.id === secId);
        if (found) list.push(found);
      }
    }
    return list;
  }, [sections, lockedSectionIds]);

  // Running locked credits tally
  const lockedCreditsSum = useMemo(() => {
    return lockedSectionsList.reduce((sum, s) => sum + (s.credits || 0), 0);
  }, [lockedSectionsList]);

  // Check if locked sections conflict with each other
  const lockedConflict = useMemo(() => {
    for (let i = 0; i < lockedSectionsList.length; i++) {
      for (let j = i + 1; j < lockedSectionsList.length; j++) {
        if (sessionsConflict(lockedSectionsList[i].sessions, lockedSectionsList[j].sessions)) {
          return {
            secA: lockedSectionsList[i],
            secB: lockedSectionsList[j],
          };
        }
      }
    }
    return null;
  }, [lockedSectionsList]);

  // Total possible credits in entire catalog
  const totalCatalogCredits = useMemo(() => {
    return courseGroups.reduce((sum, g) => sum + (g.sections[0]?.credits || 3), 0);
  }, [courseGroups]);

  // Preference Handlers
  const handleToggleCreditMode = (isRange: boolean) => {
    onUpdatePreferences({
      ...preferences,
      useCreditRange: isRange,
      minCredits: isRange ? Math.max(1, Math.min(MAX_ALLOWED_CREDITS, targetCredits - 3)) : minCredits,
      maxCredits: isRange ? Math.min(MAX_ALLOWED_CREDITS, targetCredits) : maxCredits,
    });
  };

  const handleToggleFreeDay = (day: DayOfWeek) => {
    const next = freeDays.includes(day)
      ? freeDays.filter((d) => d !== day)
      : [...freeDays, day];
    onUpdatePreferences({
      ...preferences,
      freeDays: next,
    });
  };

  const handleToggleMandatoryCourse = (courseName: string) => {
    const current = mandatoryCourses || [];
    const next = current.includes(courseName)
      ? current.filter((c) => c !== courseName)
      : [...current, courseName];
    onUpdatePreferences({
      ...preferences,
      mandatoryCourses: next,
    });
  };

  const handleLockSection = (courseName: string, sectionId: string) => {
    onUpdatePreferences({
      ...preferences,
      lockedSectionIds: {
        ...lockedSectionIds,
        [courseName]: sectionId,
      },
    });
  };

  // Validation
  const currentCreditCeiling = useCreditRange ? maxCredits : targetCredits;
  const isLockedCreditsExceeded = lockedCreditsSum > currentCreditCeiling;
  const hasError = !!lockedConflict || isLockedCreditsExceeded;

  return (
    <div className="max-w-5xl mx-auto py-8 sm:py-12 px-4 sm:px-6">
      {/* Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-neutral-100 pb-6">
        <div>
          <span className="text-[11px] font-mono tracking-widest text-neutral-400 uppercase">Step 03 / 04</span>
          <h1 className="text-3xl sm:text-4xl font-serif text-black tracking-tight font-normal mt-1">
            Credit Targets & Schedule Filters
          </h1>
          <p className="text-sm text-neutral-500 mt-1 max-w-xl font-light">
            Customize your credit goals (up to 17 credits maximum), select mandatory courses, eliminate unwanted time slots, choose desired free days, and pin specific sections.
          </p>
        </div>
      </div>

      {/* Immediate Conflict Warning */}
      {lockedConflict && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-xs text-red-900 shadow-2xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
          <div>
            <strong className="block font-semibold mb-0.5">Time Collision in Locked Courses</strong>
            <span>
              <strong>{lockedConflict.secA.name} ({lockedConflict.secA.id})</strong> conflicts directly with{' '}
              <strong>{lockedConflict.secB.name} ({lockedConflict.secB.id})</strong>. Please unlock one of these sections below to calculate valid schedules.
            </span>
          </div>
        </div>
      )}

      {isLockedCreditsExceeded && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-xs text-red-900 shadow-2xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
          <div>
            <strong className="block font-semibold mb-0.5">Target Credits Exceeded</strong>
            <span>
              Your locked sections total <strong>{lockedCreditsSum} credits</strong>, which exceeds your maximum goal of {currentCreditCeiling} credits (17 max). Increase your credit target or unlock a section.
            </span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* PANEL 1: CREDIT TARGET (MAX 17) */}
        <div className="lg:col-span-2 bg-white border border-neutral-200 rounded-3xl p-6 sm:p-7 shadow-xs space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-xl font-serif font-normal text-black">
                Semester Credit Goal (Max 17)
              </h2>
              <p className="text-xs text-neutral-500 font-light mt-0.5">
                Set an exact target (e.g. 17 cr) or an acceptable credit range (e.g. 14–17 cr). Maximum allowed limit is 17 credits.
              </p>
            </div>

            {/* Exact vs Range Toggle */}
            <div className="flex items-center bg-[#FAF9F6] border border-neutral-200 rounded-full p-1">
              <button
                type="button"
                onClick={() => handleToggleCreditMode(false)}
                className={`px-3 py-1 text-xs font-semibold rounded-full transition cursor-pointer ${
                  !useCreditRange ? 'bg-black text-white shadow-xs' : 'text-neutral-500 hover:text-black'
                }`}
              >
                Exact Target
              </button>
              <button
                type="button"
                onClick={() => handleToggleCreditMode(true)}
                className={`px-3 py-1 text-xs font-semibold rounded-full transition cursor-pointer ${
                  useCreditRange ? 'bg-black text-white shadow-xs' : 'text-neutral-500 hover:text-black'
                }`}
              >
                Flexible Range
              </button>
            </div>
          </div>

          {!useCreditRange ? (
            /* Exact Target Mode */
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-[#FAF9F6] border border-neutral-200/80 rounded-2xl">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-black block">
                    Exact Credit Total
                  </span>
                  <span className="text-[11px] text-neutral-500 font-light">
                    Every calculated schedule will match this number exactly (1 to 17 credits).
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      onUpdatePreferences({
                        ...preferences,
                        targetCredits: Math.max(1, targetCredits - 1),
                      })
                    }
                    className="w-8 h-8 rounded-full bg-white border border-neutral-200 text-black font-mono font-bold hover:bg-neutral-100 flex items-center justify-center cursor-pointer"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="1"
                    max={MAX_ALLOWED_CREDITS}
                    value={targetCredits}
                    onChange={(e) => {
                      const parsed = parseInt(e.target.value, 10);
                      const clamped = isNaN(parsed) ? 1 : Math.max(1, Math.min(MAX_ALLOWED_CREDITS, parsed));
                      onUpdatePreferences({
                        ...preferences,
                        targetCredits: clamped,
                      });
                    }}
                    className="w-16 px-2 py-1.5 text-center text-lg font-mono font-bold bg-white border border-neutral-300 rounded-xl text-black outline-none focus:border-black"
                  />
                  <button
                    type="button"
                    disabled={targetCredits >= MAX_ALLOWED_CREDITS}
                    onClick={() =>
                      onUpdatePreferences({
                        ...preferences,
                        targetCredits: Math.min(MAX_ALLOWED_CREDITS, targetCredits + 1),
                      })
                    }
                    className="w-8 h-8 rounded-full bg-white border border-neutral-200 text-black font-mono font-bold hover:bg-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer"
                  >
                    +
                  </button>
                  <span className="text-xs font-semibold text-neutral-600 uppercase tracking-wider ml-1">credits</span>
                </div>
              </div>

              {/* Quick Credit Suggestions */}
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <span className="text-[11px] font-mono text-neutral-400">Quick Select:</span>
                {totalCatalogCredits > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      onUpdatePreferences({
                        ...preferences,
                        targetCredits: Math.min(MAX_ALLOWED_CREDITS, totalCatalogCredits),
                      })
                    }
                    className={`px-2.5 py-1 rounded-lg font-mono text-[11px] font-medium transition cursor-pointer border ${
                      targetCredits === Math.min(MAX_ALLOWED_CREDITS, totalCatalogCredits)
                        ? 'bg-black text-white border-black'
                        : 'bg-white text-neutral-700 border-neutral-200 hover:border-black'
                    }`}
                  >
                    All Courses ({Math.min(MAX_ALLOWED_CREDITS, totalCatalogCredits)} cr)
                  </button>
                )}
                {[12, 14, 15, 16, 17]
                  .filter((c) => c <= totalCatalogCredits && c !== totalCatalogCredits)
                  .map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() =>
                        onUpdatePreferences({
                          ...preferences,
                          targetCredits: c,
                        })
                      }
                      className={`px-2 py-0.5 rounded-lg font-mono text-[11px] transition cursor-pointer border ${
                        targetCredits === c
                          ? 'bg-black text-white border-black'
                          : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400'
                      }`}
                    >
                      {c} cr
                    </button>
                  ))}
              </div>

              {targetCredits > totalCatalogCredits && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center justify-between gap-2">
                  <span>
                    Your uploaded courses total <strong>{totalCatalogCredits} credits</strong>, which is less than your {targetCredits} cr target.
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdatePreferences({
                        ...preferences,
                        targetCredits: Math.min(MAX_ALLOWED_CREDITS, totalCatalogCredits),
                      })
                    }
                    className="px-2.5 py-1 bg-amber-200 hover:bg-amber-300 font-semibold rounded-lg shrink-0 transition"
                  >
                    Set to {Math.min(MAX_ALLOWED_CREDITS, totalCatalogCredits)} cr
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Flexible Range Mode */
            <div className="space-y-4 p-4 bg-[#FAF9F6] border border-neutral-200/80 rounded-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-black block">
                    Acceptable Credit Range (Max 17)
                  </span>
                  <span className="text-[11px] text-neutral-500 font-light">
                    Permutations within this credit window will be calculated.
                  </span>
                </div>
                <div className="text-xs font-mono font-bold bg-white border border-neutral-200 px-3 py-1 rounded-full text-black">
                  {minCredits} to {maxCredits} credits
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-neutral-600 block">Min Credits</label>
                  <input
                    type="number"
                    min="1"
                    max={maxCredits}
                    value={minCredits}
                    onChange={(e) => {
                      const parsed = parseInt(e.target.value, 10);
                      const clamped = isNaN(parsed) ? 1 : Math.max(1, Math.min(maxCredits, parsed));
                      onUpdatePreferences({
                        ...preferences,
                        minCredits: clamped,
                      });
                    }}
                    className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-xl text-xs font-mono font-semibold text-center text-black outline-none focus:border-black"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-neutral-600 block">Max Credits (Max 17)</label>
                  <input
                    type="number"
                    min={minCredits}
                    max={MAX_ALLOWED_CREDITS}
                    value={maxCredits}
                    onChange={(e) => {
                      const parsed = parseInt(e.target.value, 10);
                      const clamped = isNaN(parsed) ? MAX_ALLOWED_CREDITS : Math.max(minCredits, Math.min(MAX_ALLOWED_CREDITS, parsed));
                      onUpdatePreferences({
                        ...preferences,
                        maxCredits: clamped,
                      });
                    }}
                    className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-xl text-xs font-mono font-semibold text-center text-black outline-none focus:border-black"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Locked Credits Tracker */}
          <div className="pt-2 border-t border-neutral-100 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  lockedCreditsSum > 0 ? 'bg-black' : 'bg-neutral-300'
                }`}
              />
              <span className="text-neutral-700">
                Locked selections: <strong>{lockedCreditsSum}</strong> / {currentCreditCeiling} credits
              </span>
            </div>
            <span className="text-neutral-500 font-light">
              Catalog total capacity: {totalCatalogCredits} credits
            </span>
          </div>
        </div>

        {/* PANEL 2: TIMING & DAY FILTERS */}
        <div className="bg-white border border-neutral-200 rounded-3xl p-6 sm:p-7 shadow-xs space-y-5">
          <div>
            <h2 className="text-xl font-serif font-normal text-black">
              Time & Day Filters
            </h2>
            <p className="text-xs text-neutral-500 font-light mt-0.5">
              Set boundaries to tailor schedules to your lifestyle.
            </p>
          </div>

          {/* Earliest start time */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-black flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-neutral-400" />
              <span>Earliest Class Start</span>
            </label>
            <select
              value={earliestStartTime}
              onChange={(e) =>
                onUpdatePreferences({
                  ...preferences,
                  earliestStartTime: e.target.value,
                })
              }
              className="w-full px-3 py-2 bg-[#FAF9F6] border border-neutral-200 rounded-xl text-xs text-black font-medium outline-none focus:border-black"
            >
              <option value="ANY">Anytime (No morning restriction)</option>
              <option value="08:30">No classes before 08:30 AM</option>
              <option value="09:00">No classes before 09:00 AM</option>
              <option value="10:00">No classes before 10:00 AM</option>
              <option value="11:00">No classes before 11:00 AM</option>
            </select>
          </div>

          {/* Latest end time */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-black flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-neutral-400" />
              <span>Latest Class End</span>
            </label>
            <select
              value={latestEndTime}
              onChange={(e) =>
                onUpdatePreferences({
                  ...preferences,
                  latestEndTime: e.target.value,
                })
              }
              className="w-full px-3 py-2 bg-[#FAF9F6] border border-neutral-200 rounded-xl text-xs text-black font-medium outline-none focus:border-black"
            >
              <option value="ANY">Anytime (No evening restriction)</option>
              <option value="16:00">Finish by 04:00 PM</option>
              <option value="17:00">Finish by 05:00 PM</option>
              <option value="18:00">Finish by 06:00 PM</option>
              <option value="19:00">Finish by 07:00 PM</option>
            </select>
          </div>

          {/* Preferred Free Days */}
          <div className="space-y-2 pt-2 border-t border-neutral-100">
            <label className="text-xs font-semibold text-black flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-neutral-400" />
              <span>Desired Free Days</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {(['MON', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as DayOfWeek[]).map((d) => {
                const isSelected = freeDays.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => handleToggleFreeDay(d)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition cursor-pointer ${
                      isSelected
                        ? 'bg-black text-white shadow-xs'
                        : 'bg-[#FAF9F6] text-neutral-600 border border-neutral-200 hover:border-black'
                    }`}
                  >
                    {d} Free
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* MANDATORY COURSES SELECTION */}
      <div className="space-y-4 mb-8">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-400">Core Requirement</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-serif text-black font-normal tracking-tight mt-0.5">
            Mandatory Courses (Always Included)
          </h2>
          <p className="text-xs text-neutral-500 font-light mt-0.5 max-w-2xl">
            Select courses that <strong>must be present in every single combination</strong>. If a mandatory course offers multiple sections/times, the optimizer tests all offerings and selects the one that minimizes your break gap.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {courseGroups.map((group) => {
            const courseColor = getCourseColor(group.name, group.colorIndex);
            const isMandatory = mandatoryCourses.includes(group.name);
            const credits = group.sections[0]?.credits ?? 3;

            return (
              <div
                key={`mandatory-${group.name}`}
                onClick={() => handleToggleMandatoryCourse(group.name)}
                className={`p-3.5 rounded-2xl border transition cursor-pointer select-none flex items-start gap-3 ${
                  isMandatory
                    ? 'bg-[#FAF9F6] border-black shadow-xs ring-1 ring-black/5'
                    : 'bg-white border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50/50'
                }`}
              >
                <button
                  type="button"
                  className="mt-0.5 shrink-0 text-black focus:outline-none"
                >
                  {isMandatory ? (
                    <CheckSquare className="w-4 h-4 fill-black text-white" />
                  ) : (
                    <Square className="w-4 h-4 text-neutral-300" />
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/10"
                      style={{ backgroundColor: courseColor.swatchHex }}
                    />
                    <h3 className="font-semibold text-xs text-black truncate">
                      {group.name}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2 mt-1 text-[11px] font-mono text-neutral-500">
                    <span>{credits} cr</span>
                    <span>·</span>
                    <span>{group.sections.length} offering{group.sections.length !== 1 ? 's' : ''}</span>
                    {isMandatory && (
                      <span className="font-sans text-[10px] bg-black text-white px-1.5 py-0.2 rounded font-semibold ml-auto">
                        MANDATORY
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION LOCKS */}
      <div className="space-y-4 mb-8">
        <div>
          <h2 className="text-xl sm:text-2xl font-serif text-black font-normal tracking-tight">
            Lock Specific Sections (Optional)
          </h2>
          <p className="text-xs text-neutral-500 font-light mt-0.5">
            Pin a specific section if you must attend a certain professor or timing. Leave as "Automatic Selection" to discover the schedule with the shortest waiting gaps.
          </p>
        </div>

        <div className="space-y-3">
          {courseGroups.map((group) => {
            const courseColor = getCourseColor(group.name, group.colorIndex);
            const currentLockedId = lockedSectionIds[group.name] || '';

            return (
              <div
                key={group.name}
                className="p-4 sm:p-5 bg-white border border-neutral-200 rounded-2xl shadow-xs"
              >
                {/* Course Header */}
                <div className="flex items-center justify-between border-b border-neutral-100 pb-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-3.5 h-3.5 rounded-full border border-black/10 shadow-2xs"
                      style={{ backgroundColor: courseColor.swatchHex }}
                    />
                    <h3 className="font-serif text-base font-normal text-black">
                      {group.name}
                    </h3>
                    <span className="text-[11px] font-mono text-neutral-400">
                      ({group.sections.length} section{group.sections.length !== 1 ? 's' : ''})
                    </span>
                  </div>

                  {currentLockedId ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-black bg-neutral-100 px-2.5 py-0.5 rounded-full border border-neutral-300">
                      <Lock className="w-3 h-3" />
                      Locked to {currentLockedId}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] text-neutral-400">
                      <Unlock className="w-3 h-3" />
                      Automatic Selection
                    </span>
                  )}
                </div>

                {/* Radio Options */}
                <div className="space-y-2">
                  <label className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-neutral-50 cursor-pointer transition border border-transparent">
                    <input
                      type="radio"
                      name={`course-lock-${group.name}`}
                      value=""
                      checked={currentLockedId === ''}
                      onChange={() => handleLockSection(group.name, '')}
                      className="mt-0.5 text-black focus:ring-black w-4 h-4 cursor-pointer"
                    />
                    <div className="text-xs">
                      <span className="font-semibold text-black">
                        Auto-pick optimal section (Minimizes breaks)
                      </span>
                    </div>
                  </label>

                  {group.sections.map((sec) => {
                    const isChecked = currentLockedId === sec.id;
                    const sessionTimings = sec.sessions
                      .map((s) => `${s.day} ${s.start}–${s.end}`)
                      .join(', ');

                    return (
                      <label
                        key={sec.id}
                        className={`flex items-start gap-3 p-2.5 rounded-xl cursor-pointer transition border ${
                          isChecked
                            ? 'bg-[#FAF9F6] border-black shadow-2xs'
                            : 'border-transparent hover:bg-neutral-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name={`course-lock-${group.name}`}
                          value={sec.id}
                          checked={isChecked}
                          onChange={() => handleLockSection(group.name, sec.id)}
                          className="mt-0.5 text-black focus:ring-black w-4 h-4 cursor-pointer"
                        />
                        <div className="text-xs flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-black">{sec.id}</span>
                            <span className="text-neutral-400">·</span>
                            <span className="font-mono text-neutral-700">{sessionTimings}</span>
                            <span className="text-neutral-400">·</span>
                            <span className="text-neutral-500">{sec.credits} cr</span>
                          </div>
                          {sec.instructor && (
                            <p className="text-[11px] text-neutral-500 mt-0.5">
                              Instructor: {sec.instructor}
                            </p>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Performance Note for Large Catalogs */}
      {sections.length > 25 && (
        <div className="mb-6 p-4 bg-amber-50/70 border border-amber-200 rounded-2xl flex items-start gap-3 text-xs text-amber-900">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <strong>Performance note:</strong> Your course catalog is large ({sections.length} total sections across {courseGroups.length} subjects). An exhaustive non-sampled search will test every combination. If you experience search delays, consider locking specific sections above or narrowing your subject list.
          </div>
        </div>
      )}

      {/* Navigation Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-neutral-200">
        <button
          onClick={onBackToReview}
          className="inline-flex items-center gap-1.5 px-6 py-2.5 text-xs font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-full transition cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Review</span>
        </button>

        <button
          id="btn-run-optimizer"
          disabled={hasError}
          onClick={onRunOptimizer}
          className="inline-flex items-center gap-2 px-8 py-3 bg-black text-white text-xs font-semibold rounded-full hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-xs cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Calculate Best Schedules (Max 17 cr)</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
