import React, { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  Download,
  Printer,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  ArrowLeft,
  Sliders,
  Sparkles,
  Star,
  Layers,
  Columns,
  Search,
  Coffee,
  X,
  Share2,
  Bookmark,
} from 'lucide-react';
import { OptimizationResult, OptimizerOutput, Section, Session, DayOfWeek } from '../types';
import { formatMinutes, timeToMinutes } from '../utils/optimizer';
import { getCourseColor } from '../utils/colors';
import { downloadICS, formatScheduleAsText } from '../utils/export';

interface StepResultsProps {
  optimizerOutput: OptimizerOutput;
  targetCredits: number;
  onBackToPreferences: () => void;
  onBackToAddCourses: () => void;
  onAutoFixPreference?: (updatedPref: Partial<SchedulePreferences>) => void;
}

type ViewFilterTab = 'all' | 'favorites' | '3days' | '4days' | '5days';

export const StepResults: React.FC<StepResultsProps> = ({
  optimizerOutput,
  targetCredits,
  onBackToPreferences,
  onBackToAddCourses,
  onAutoFixPreference,
}) => {
  const [activeFilterTab, setActiveFilterTab] = useState<ViewFilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [favoriteScheduleIds, setFavoriteScheduleIds] = useState<Set<string>>(new Set());
  const [comparedScheduleIds, setComparedScheduleIds] = useState<string[]>([]);
  const [showComparisonModal, setShowComparisonModal] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeScheduleDayTabs, setActiveScheduleDayTabs] = useState<Record<string, DayOfWeek>>({});
  const [viewModes, setViewModes] = useState<Record<string, 'grid' | 'agenda'>>({});

  // Flatten all schedules into a ranked list
  const allRankedSchedules = useMemo(() => {
    const list: { schedule: OptimizationResult; dayCount: number; rank: number }[] = [];
    const days = [3, 4, 5, 6, 7];
    let overallRank = 1;

    for (const d of days) {
      const subset = optimizerOutput.byDayCount[d] || [];
      for (const sch of subset) {
        list.push({ schedule: sch, dayCount: d, rank: overallRank++ });
      }
    }

    return list.sort((a, b) => a.schedule.totalGap - b.schedule.totalGap || a.schedule.numDays - b.schedule.numDays);
  }, [optimizerOutput]);

  // Unique course list for color legend
  const uniqueCourseNames = useMemo(() => {
    const names = new Set<string>();
    for (const s of optimizerOutput.allSectionsConsidered) {
      names.add(s.name);
    }
    return Array.from(names);
  }, [optimizerOutput.allSectionsConsidered]);

  // Filtered schedules according to active tab & search
  const filteredSchedules = useMemo(() => {
    return allRankedSchedules.filter(({ schedule, dayCount }) => {
      // Tab filter
      if (activeFilterTab === 'favorites' && !favoriteScheduleIds.has(schedule.id)) {
        return false;
      }
      if (activeFilterTab === '3days' && dayCount !== 3) return false;
      if (activeFilterTab === '4days' && dayCount !== 4) return false;
      if (activeFilterTab === '5days' && dayCount !== 5) return false;

      // Search query
      if (searchQuery.trim()) {
        const q紧 = searchQuery.toLowerCase().trim();
        const matchesSection = schedule.sections.some(
          (s) =>
            s.name.toLowerCase().includes(q紧) ||
            s.id.toLowerCase().includes(q紧) ||
            (s.instructor && s.instructor.toLowerCase().includes(q紧))
        );
        if (!matchesSection) return false;
      }

      return true;
    });
  }, [allRankedSchedules, activeFilterTab, favoriteScheduleIds, searchQuery]);

  // Favorites toggle
  const toggleFavorite = (scheduleId: string) => {
    setFavoriteScheduleIds((prev) => {
      const next = new Set(prev);
      if (next.has(scheduleId)) next.delete(scheduleId);
      else next.add(scheduleId);
      return next;
    });
  };

  // Compare toggles (max 3)
  const toggleCompare = (scheduleId: string) => {
    setComparedScheduleIds((prev) => {
      if (prev.includes(scheduleId)) {
        return prev.filter((id) => id !== scheduleId);
      }
      if (prev.length >= 3) {
        return [...prev.slice(1), scheduleId];
      }
      return [...prev, scheduleId];
    });
  };

  const handleCopyText = (schedule: OptimizationResult, optionIndex: number) => {
    const text = formatScheduleAsText(schedule, optionIndex);
    navigator.clipboard.writeText(text);
    setCopiedId(schedule.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  const comparedSchedules = useMemo(() => {
    return comparedScheduleIds
      .map((id) => allRankedSchedules.find((item) => item.schedule.id === id)?.schedule)
      .filter((s): s is OptimizationResult => !!s);
  }, [comparedScheduleIds, allRankedSchedules]);

  const totalSchedulesFound = allRankedSchedules.length;

  return (
    <div className="max-w-7xl mx-auto py-8 sm:py-12 px-4 sm:px-6">
      {/* Top Title Bar */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 border-b border-neutral-100 pb-6">
        <div>
          <span className="text-[11px] font-mono tracking-widest text-neutral-400 uppercase">Step 04 / 04</span>
          <h1 className="text-3xl sm:text-4xl font-serif text-black tracking-tight font-normal mt-1">
            Generated Schedules & Rankings
          </h1>
          <p className="text-sm text-neutral-500 mt-1 max-w-2xl font-light">
            Exhaustive, conflict-free search across every section combination that reaches your target credit total, ranked purely by lowest total gap time.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap no-print">
          {comparedScheduleIds.length > 0 && (
            <button
              onClick={() => setShowComparisonModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white text-xs font-semibold rounded-full hover:bg-neutral-800 transition shadow-sm animate-pulse"
            >
              <Columns className="w-3.5 h-3.5" />
              <span>Compare {comparedScheduleIds.length} Schedules</span>
            </button>
          )}

          <button
            type="button"
            onClick={onBackToPreferences}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-neutral-700 bg-white border border-neutral-200 hover:border-black rounded-full transition shadow-2xs"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Refine Filters</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-neutral-700 bg-white border border-neutral-200 hover:border-black rounded-full transition shadow-2xs"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Sheet</span>
          </button>
        </div>
      </div>

      {/* STEP 4 REQUIREMENT 1: Full list of course timings under consideration (printed before any ranking) */}
      <div className="mb-10 p-6 bg-white border border-neutral-200 rounded-3xl shadow-xs">
        <div className="flex items-center justify-between gap-4 mb-4 pb-3 border-b border-neutral-100">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-400 block">Catalog Overview</span>
            <h2 className="text-xl font-serif font-normal text-black mt-0.5">
              Course Timings Under Consideration ({optimizerOutput.allSectionsConsidered.length} Sections)
            </h2>
          </div>
          <span className="text-xs font-mono text-neutral-500 bg-[#FAF9F6] px-3 py-1 rounded-full border border-neutral-200">
            Target: {targetCredits} credits
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-neutral-200 bg-[#FAF9F6] text-neutral-700 font-semibold font-mono text-[11px] uppercase">
                <th className="py-2.5 px-3">Subject / Course</th>
                <th className="py-2.5 px-3">Section ID</th>
                <th className="py-2.5 px-3">Days</th>
                <th className="py-2.5 px-3">Times</th>
                <th className="py-2.5 px-3">Credits</th>
                <th className="py-2.5 px-3">Instructor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {optimizerOutput.allSectionsConsidered.map((sec) => {
                const color = getCourseColor(sec.name, sec.colorIndex);
                return (
                  <tr key={sec.id} className="hover:bg-neutral-50/50 transition">
                    <td className="py-2.5 px-3 font-medium text-black">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/10"
                          style={{ backgroundColor: color.swatchHex }}
                        />
                        <span>{sec.name}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-neutral-700">{sec.id}</td>
                    <td className="py-2.5 px-3 font-mono font-medium text-black">
                      {sec.sessions.map((s) => s.day).join(', ')}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-neutral-600">
                      {sec.sessions.map((s) => `${s.start}–${s.end}`).join('; ')}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-neutral-800">
                      {sec.credits ?? '—'} cr
                    </td>
                    <td className="py-2.5 px-3 text-neutral-500 font-light truncate max-w-[150px]">
                      {sec.instructor || '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Course Color Legend */}
      {uniqueCourseNames.length > 0 && (
        <div className="mb-6 p-4 bg-[#FAF9F6] border border-neutral-200/80 rounded-2xl flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-black">Courses:</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {uniqueCourseNames.map((name) => {
              const color = getCourseColor(name);
              return (
                <div key={name} className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-full border border-neutral-200 shadow-2xs">
                  <div
                    className="w-2.5 h-2.5 rounded-full border border-black/10"
                    style={{ backgroundColor: color.swatchHex }}
                  />
                  <span className="text-xs font-medium text-black">{name}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* FILTER & SEARCH TABS */}
      {totalSchedulesFound > 0 && (
        <div className="mb-8 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-3 border border-neutral-200 rounded-2xl shadow-xs">
          {/* Tab buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            <button
              onClick={() => setActiveFilterTab('all')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-full transition shrink-0 ${
                activeFilterTab === 'all'
                  ? 'bg-black text-white shadow-xs'
                  : 'bg-[#FAF9F6] text-neutral-600 hover:text-black border border-neutral-200'
              }`}
            >
              Top Ranked by Days ({allRankedSchedules.length})
            </button>

            <button
              onClick={() => setActiveFilterTab('favorites')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-full transition shrink-0 ${
                activeFilterTab === 'favorites'
                  ? 'bg-black text-white shadow-xs'
                  : 'bg-[#FAF9F6] text-neutral-600 hover:text-black border border-neutral-200'
              }`}
            >
              <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
              <span>Favorites ({favoriteScheduleIds.size})</span>
            </button>

            <button
              onClick={() => setActiveFilterTab('4days')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-full transition shrink-0 ${
                activeFilterTab === '4days'
                  ? 'bg-black text-white shadow-xs'
                  : 'bg-[#FAF9F6] text-neutral-600 hover:text-black border border-neutral-200'
              }`}
            >
              4-Day Campus Week ({optimizerOutput.totalFoundByDay[4] || 0})
            </button>

            <button
              onClick={() => setActiveFilterTab('5days')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-full transition shrink-0 ${
                activeFilterTab === '5days'
                  ? 'bg-black text-white shadow-xs'
                  : 'bg-[#FAF9F6] text-neutral-600 hover:text-black border border-neutral-200'
              }`}
            >
              5-Day Campus Week ({optimizerOutput.totalFoundByDay[5] || 0})
            </button>

            <button
              onClick={() => setActiveFilterTab('3days')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-full transition shrink-0 ${
                activeFilterTab === '3days'
                  ? 'bg-black text-white shadow-xs'
                  : 'bg-[#FAF9F6] text-neutral-600 hover:text-black border border-neutral-200'
              }`}
            >
              6-Day Campus Week ({optimizerOutput.totalFoundByDay[6] || 0})
            </button>
          </div>

          {/* Search box */}
          <div className="relative w-full sm:w-64 shrink-0">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search section or instructor..."
              className="w-full pl-9 pr-3 py-1.5 bg-[#FAF9F6] border border-neutral-200 rounded-full text-xs text-black placeholder:text-neutral-400 outline-none focus:border-black"
            />
          </div>
        </div>
      )}

      {/* STEP 4 REQUIREMENT 2-4: TOP 3 FOR 4-DAY, 5-DAY, AND 6-DAY CAMPUS WEEKS SUMMARY CARDS */}
      <div className="mb-10 grid grid-cols-1 md:grid-cols-3 gap-4">
        {[4, 5, 6].map((targetDay) => {
          const count = optimizerOutput.totalFoundByDay[targetDay] || 0;
          const topList = optimizerOutput.byDayCount[targetDay] || [];
          return (
            <div key={targetDay} className="p-4 bg-[#FAF9F6] border border-neutral-200 rounded-2xl">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-xs text-black">{targetDay}-Day Campus Week</span>
                <span className="font-mono text-[11px] px-2 py-0.5 bg-white rounded border border-neutral-200 text-neutral-700">
                  {count} total found
                </span>
              </div>
              <p className="text-xs text-neutral-600 mt-2 font-light">
                {count === 0 && `No valid schedule exists for a ${targetDay}-day week under these settings.`}
                {count > 0 && count < 3 && `Only ${count} valid schedule${count === 1 ? '' : 's'} found for this day count.`}
                {count >= 3 && `Top 3 schedules shown (ranked by lowest total gap time).`}
              </p>
              {topList.length > 0 && (
                <div className="mt-3 pt-2.5 border-t border-neutral-200/60 space-y-1.5 text-[11px] font-mono">
                  {topList.slice(0, 3).map((r, i) => (
                    <div key={r.id} className="flex items-center justify-between text-neutral-700">
                      <span>#{i + 1} ({formatMinutes(r.totalGap)})</span>
                      {r.isTie && (
                        <span className="text-[10px] bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded font-sans font-medium">
                          Tied
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* NO RESULTS FALLBACK / DIAGNOSTICS */}
      {totalSchedulesFound === 0 && (
        <div className="p-8 sm:p-12 bg-white border border-neutral-200 rounded-3xl text-center space-y-6 shadow-xs">
          <div className="w-12 h-12 bg-neutral-100 text-black rounded-full flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6 text-black" />
          </div>

          <div className="max-w-md mx-auto space-y-2">
            <h2 className="text-2xl font-serif font-normal text-black">
              No Conflict-Free Timetables for Exact Settings
            </h2>
            <p className="text-xs text-neutral-600 leading-relaxed font-light">
              We evaluated every possible combination, but no schedule satisfied your exact filters and target credit hours without overlapping classes.
            </p>
          </div>

          {/* AUTO-FIX ACTION BANNER */}
          {optimizerOutput.impossibleDiagnostic && (
            <div className="max-w-xl mx-auto p-5 bg-black text-white rounded-3xl text-left space-y-3 shadow-md">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-200">
                  Diagnosis & Instant Fix
                </span>
              </div>
              <p className="text-xs text-neutral-200 leading-relaxed">
                <strong>{optimizerOutput.impossibleDiagnostic.reason}</strong>
              </p>
              <p className="text-xs text-neutral-400 font-light">
                {optimizerOutput.impossibleDiagnostic.suggestion}
              </p>

              {onAutoFixPreference && optimizerOutput.impossibleDiagnostic.actionType && (
                <div className="pt-2">
                  <button
                    onClick={() => {
                      const diag = optimizerOutput.impossibleDiagnostic;
                      if (!diag) return;
                      if (diag.actionType === 'auto_adjust_credits' && diag.suggestedTargetCredits) {
                        onAutoFixPreference({ targetCredits: diag.suggestedTargetCredits });
                      } else if (diag.actionType === 'clear_free_days') {
                        onAutoFixPreference({ freeDays: [] });
                      } else if (diag.actionType === 'clear_time_limits') {
                        onAutoFixPreference({ earliestStartTime: 'ANY', latestEndTime: 'ANY' });
                      } else if (diag.actionType === 'unmark_mandatory') {
                        onAutoFixPreference({ mandatoryCourses: [] });
                      }
                    }}
                    className="w-full sm:w-auto px-6 py-2.5 bg-white text-black text-xs font-bold rounded-full hover:bg-neutral-100 transition cursor-pointer shadow-xs"
                  >
                    {optimizerOutput.impossibleDiagnostic.actionLabel || 'Apply Recommended Adjustment'}
                  </button>
                </div>
              )}
            </div>
          )}

          {optimizerOutput.diagnostics && optimizerOutput.diagnostics.length > 0 && (
            <div className="max-w-lg mx-auto p-4 bg-[#FAF9F6] border border-neutral-200 rounded-2xl text-left text-xs space-y-2">
              <span className="font-semibold text-black block">Constraint Breakdown:</span>
              <ul className="list-disc list-inside space-y-1 text-neutral-600 font-light">
                {optimizerOutput.diagnostics.map((d, idx) => (
                  <li key={idx}>{d}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center justify-center gap-3 pt-2 flex-wrap">
            <button
              onClick={onBackToPreferences}
              className="px-6 py-2.5 bg-black text-white text-xs font-semibold rounded-full hover:bg-neutral-800 transition"
            >
              Adjust Preferences & Time Bounds
            </button>
            <button
              onClick={onBackToAddCourses}
              className="px-6 py-2.5 bg-neutral-100 text-neutral-800 text-xs font-semibold rounded-full hover:bg-neutral-200 transition"
            >
              Add Alternative Sections
            </button>
          </div>
        </div>
      )}

      {/* SCHEDULE CARDS LIST */}
      <div className="space-y-10">
        {filteredSchedules.map(({ schedule, rank }) => {
          const isFavorite = favoriteScheduleIds.has(schedule.id);
          const isCompared = comparedScheduleIds.includes(schedule.id);
          const viewMode = viewModes[schedule.id] || 'grid';
          const activeDay = activeScheduleDayTabs[schedule.id] || schedule.days[0] || 'MON';

          return (
            <div
              key={schedule.id}
              id={schedule.id}
              className={`bg-white border rounded-3xl shadow-xs overflow-hidden transition ${
                isFavorite
                  ? 'border-neutral-400 ring-1 ring-neutral-400'
                  : 'border-neutral-200 hover:border-neutral-300'
              }`}
            >
              {/* Card Header Bar */}
              <div className="p-5 sm:p-6 bg-[#FAF9F6] border-b border-neutral-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-full bg-black text-white text-xs font-mono font-bold flex items-center justify-center shadow-xs">
                    #{rank}
                  </span>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-lg font-serif font-normal text-black">
                        Option {rank}: {schedule.numDays} Days / Week
                      </h2>
                      {schedule.isTie && (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-semibold uppercase tracking-wider rounded-full">
                          ★ Tied by Gap Time
                        </span>
                      )}
                      {schedule.totalGap === 0 && (
                        <span className="px-2 py-0.5 bg-neutral-200 text-black text-[10px] font-semibold uppercase tracking-wider rounded-full">
                          Zero Break Gap
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-neutral-600 font-light mt-0.5 flex-wrap">
                      <span>Total Break Gap: <strong className="font-semibold text-black">{formatMinutes(schedule.totalGap)}</strong></span>
                      <span>•</span>
                      <span>Total Credits: <strong className="font-semibold text-black">{schedule.totalCredits} cr</strong></span>
                      <span>•</span>
                      <span>Days: <strong className="font-mono text-neutral-800">{schedule.days.join(', ')}</strong></span>
                    </div>
                  </div>
                </div>

                {/* Actions: Favorite, Compare, View Mode, Export */}
                <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap no-print">
                  {/* View Mode Toggle: Grid vs Agenda */}
                  <div className="flex items-center bg-white border border-neutral-200 rounded-full p-0.5 shadow-2xs">
                    <button
                      onClick={() => setViewModes((prev) => ({ ...prev, [schedule.id]: 'grid' }))}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded-full transition ${
                        viewMode === 'grid' ? 'bg-black text-white' : 'text-neutral-500 hover:text-black'
                      }`}
                    >
                      Weekly Grid
                    </button>
                    <button
                      onClick={() => setViewModes((prev) => ({ ...prev, [schedule.id]: 'agenda' }))}
                      className={`px-2.5 py-1 text-[11px] font-semibold rounded-full transition ${
                        viewMode === 'agenda' ? 'bg-black text-white' : 'text-neutral-500 hover:text-black'
                      }`}
                    >
                      Daily Agenda
                    </button>
                  </div>

                  {/* Bookmark / Favorite */}
                  <button
                    onClick={() => toggleFavorite(schedule.id)}
                    title={isFavorite ? 'Remove from favorites' : 'Save to favorites'}
                    className={`p-2 rounded-full border transition ${
                      isFavorite
                        ? 'bg-amber-50 border-amber-300 text-amber-600'
                        : 'bg-white border-neutral-200 text-neutral-400 hover:text-black'
                    }`}
                  >
                    <Star className={`w-3.5 h-3.5 ${isFavorite ? 'fill-amber-500 text-amber-500' : ''}`} />
                  </button>

                  {/* Compare Button */}
                  <button
                    onClick={() => toggleCompare(schedule.id)}
                    title="Compare side-by-side with other options"
                    className={`px-3 py-1.5 text-xs font-medium rounded-full border transition ${
                      isCompared
                        ? 'bg-black text-white border-black'
                        : 'bg-white text-neutral-600 border-neutral-200 hover:border-black'
                    }`}
                  >
                    {isCompared ? '✓ Compared' : '+ Compare'}
                  </button>

                  {/* Copy Text */}
                  <button
                    onClick={() => handleCopyText(schedule, rank)}
                    title="Copy Schedule Summary to Clipboard"
                    className="p-2 bg-white border border-neutral-200 hover:border-black rounded-full text-neutral-600 hover:text-black transition"
                  >
                    {copiedId === schedule.id ? (
                      <Check className="w-3.5 h-3.5 text-black" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>

                  {/* Download iCalendar */}
                  <button
                    onClick={() => downloadICS(schedule, rank)}
                    title="Export to Apple Calendar / Google Calendar (.ics)"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-neutral-200 hover:border-black rounded-full text-xs font-semibold text-black transition shadow-2xs"
                  >
                    <Download className="w-3 h-3" />
                    <span>.ICS</span>
                  </button>
                </div>
              </div>

              {/* Card Body: Timetable Grid OR Daily Agenda */}
              <div className="p-5 sm:p-6">
                {viewMode === 'grid' ? (
                  /* WEEKLY TIMETABLE GRID */
                  <div className="overflow-x-auto">
                    <TimetableWeeklyGrid schedule={schedule} />
                  </div>
                ) : (
                  /* DAILY AGENDA VIEW */
                  <div className="space-y-4">
                    <div className="flex items-center gap-1.5 border-b border-neutral-100 pb-3">
                      {schedule.days.map((day) => (
                        <button
                          key={day}
                          onClick={() =>
                            setActiveScheduleDayTabs((prev) => ({ ...prev, [schedule.id]: day }))
                          }
                          className={`px-3 py-1 text-xs font-semibold rounded-full transition ${
                            activeDay === day
                              ? 'bg-black text-white shadow-xs'
                              : 'bg-[#FAF9F6] text-neutral-600 hover:text-black border border-neutral-200'
                          }`}
                        >
                          {day}
                        </button>
                      ))}
                    </div>

                    <TimetableDayAgenda schedule={schedule} activeDay={activeDay} />
                  </div>
                )}

                {/* Section Summary Chips below schedule */}
                <div className="mt-6 pt-5 border-t border-neutral-100">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 block mb-2">
                    Enrolled Courses in this schedule:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {schedule.sections.map((sec) => {
                      const color = getCourseColor(sec.name, sec.colorIndex);
                      return (
                        <div
                          key={sec.id}
                          className="p-2.5 bg-[#FAF9F6] border border-neutral-200 rounded-xl flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <div
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: color.swatchHex }}
                              />
                              <span className="text-xs font-semibold text-black truncate">{sec.name}</span>
                            </div>
                            <div className="text-[10px] font-mono text-neutral-500 mt-0.5 truncate">
                              {sec.id} {sec.instructor ? `• ${sec.instructor}` : ''}
                            </div>
                          </div>
                          <span className="text-[10px] font-mono font-bold text-neutral-700 shrink-0 bg-white px-2 py-0.5 rounded border border-neutral-200">
                            {sec.credits} cr
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* SIDE-BY-SIDE COMPARISON MODAL */}
      {showComparisonModal && comparedSchedules.length > 0 && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-neutral-200 rounded-3xl max-w-6xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-6 border-b border-neutral-200 flex items-center justify-between bg-[#FAF9F6]">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
                  Side-by-Side Schedule Comparison
                </span>
                <h3 className="text-xl font-serif text-black font-normal">
                  Comparing {comparedSchedules.length} Timetables
                </h3>
              </div>
              <button
                onClick={() => setShowComparisonModal(false)}
                className="p-2 text-neutral-400 hover:text-black rounded-full hover:bg-neutral-200 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              <div className={`grid grid-cols-1 md:grid-cols-${comparedSchedules.length} gap-6`}>
                {comparedSchedules.map((sch, sIdx) => (
                  <div key={sch.id} className="border border-neutral-200 rounded-2xl p-4 bg-white space-y-4">
                    <div className="border-b border-neutral-100 pb-3">
                      <span className="text-xs font-mono font-bold text-black block">
                        Schedule #{sIdx + 1}
                      </span>
                      <div className="text-xs text-neutral-600 mt-1 space-y-0.5">
                        <div>Gap Break: <strong>{formatMinutes(sch.totalGap)}</strong></div>
                        <div>Days on Campus: <strong>{sch.numDays} Days ({sch.days.join(', ')})</strong></div>
                        <div>Total Credits: <strong>{sch.totalCredits} cr</strong></div>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <TimetableWeeklyGrid schedule={sch} compact />
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-neutral-100">
                      <span className="text-[10px] uppercase font-semibold text-neutral-400">Sections:</span>
                      {sch.sections.map((sec) => (
                        <div key={sec.id} className="text-xs flex items-center justify-between text-neutral-700">
                          <span className="truncate">{sec.name} ({sec.id})</span>
                          <span className="text-neutral-400 font-mono text-[10px]">{sec.credits}cr</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-neutral-200 flex items-center justify-between bg-[#FAF9F6]">
              <button
                onClick={() => setComparedScheduleIds([])}
                className="text-xs text-neutral-500 hover:text-black underline underline-offset-4"
              >
                Clear Comparison Selection
              </button>

              <button
                onClick={() => setShowComparisonModal(false)}
                className="px-6 py-2 bg-black text-white text-xs font-semibold rounded-full hover:bg-neutral-800 transition"
              >
                Close Comparison
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ==========================================
// SUBCOMPONENT: WEEKLY TIMETABLE GRID
// ==========================================
interface TimetableGridProps {
  schedule: OptimizationResult;
  compact?: boolean;
}

const TimetableWeeklyGrid: React.FC<TimetableGridProps> = ({ schedule, compact }) => {
  // Determine earliest start & latest end hour across this schedule
  let minHour = 8;
  let maxHour = 18;

  for (const sec of schedule.sections) {
    for (const sess of sec.sessions) {
      const sH = parseInt(sess.start.split(':')[0], 10);
      const eH = parseInt(sess.end.split(':')[0], 10) + (parseInt(sess.end.split(':')[1], 10) > 0 ? 1 : 0);
      if (sH < minHour) minHour = Math.max(7, sH);
      if (eH > maxHour) maxHour = Math.min(22, eH);
    }
  }

  const totalHours = maxHour - minHour;
  const hoursArray: number[] = [];
  for (let h逗 = minHour; h逗 <= maxHour; h逗++) {
    hoursArray.push(h逗);
  }

  // Days to render (filter to active days or standard Mon-Fri if sparse)
  const displayDays: DayOfWeek[] = ['MON', 'TUE', 'WED', 'THU', 'FRI'];
  // If schedule has Saturday or Sunday, add them
  if (schedule.days.includes('SAT')) displayDays.push('SAT');
  if (schedule.days.includes('SUN')) displayDays.unshift('SUN');

  return (
    <div className={`min-w-[650px] border border-neutral-200 rounded-2xl overflow-hidden bg-white ${compact ? 'text-[10px]' : ''}`}>
      {/* Header Row of Days */}
      <div className="grid grid-cols-6 border-b border-neutral-200 bg-[#FAF9F6]">
        <div className="p-2.5 text-center text-[11px] font-mono font-medium text-neutral-400 border-r border-neutral-200">
          Time
        </div>
        {displayDays.map((day) => {
          const isClassDay不易 = schedule.days.includes(day);
          return (
            <div
              key={day}
              className={`p-2.5 text-center text-xs font-semibold uppercase tracking-wider border-r last:border-r-0 border-neutral-200 ${
                isClassDay不易 ? 'text-black bg-white' : 'text-neutral-400 bg-[#FAF9F6]'
              }`}
            >
              {day}
            </div>
          );
        })}
      </div>

      {/* Grid Canvas */}
      <div className="relative grid grid-cols-6" style={{ height: `${totalHours * (compact ? 42 : 54)}px` }}>
        {/* Time column labels */}
        <div className="border-r border-neutral-200 bg-[#FAF9F6] relative">
          {hoursArray.map((h, idx) => {
            if (idx === hoursArray.length - 1) return null;
            const topPercent = (idx / totalHours) * 100;
            const formatted = `${h % 12 === 0 ? 12 : h % 12}:00 ${h >= 12 ? 'PM' : 'AM'}`;
            return (
              <div
                key={h}
                className="absolute inset-x-0 text-center font-mono text-[10px] text-neutral-500 font-medium -translate-y-2"
                style={{ top: `${topPercent}%` }}
              >
                {formatted}
              </div>
            );
          })}
        </div>

        {/* Day Columns */}
        {displayDays.map((day) => {
          const sessionsOnDay: { session: Session; section: Section }[] = [];
          for (const sec of schedule.sections) {
            for (const sess of sec.sessions) {
              if (sess.day === day) {
                sessionsOnDay.push({ session: sess, section: sec });
              }
            }
          }

          return (
            <div
              key={day}
              className="relative border-r last:border-r-0 border-neutral-200 bg-white"
            >
              {/* Horizontal hour guidelines */}
              {hoursArray.map((h, idx) => {
                if (idx === 0) return null;
                const topPercent = (idx / totalHours) * 100;
                return (
                  <div
                    key={h}
                    className="absolute inset-x-0 border-t border-neutral-100 pointer-events-none"
                    style={{ top: `${topPercent}%` }}
                  />
                );
              })}

              {/* Render Class Session Cards */}
              {sessionsOnDay.map(({ session, section }, sIdx) => {
                const startM = timeToMinutes(session.start);
                const endM = timeToMinutes(session.end);
                const minDayM = minHour * 60;
                const totalDayM = totalHours * 60;

                const topPercent = ((startM - minDayM) / totalDayM) * 100;
                const heightPercent = ((endM - startM) / totalDayM) * 100;

                const color = getCourseColor(section.name, section.colorIndex);

                return (
                  <div
                    key={`${section.id}-${sIdx}`}
                    className="absolute inset-x-1 rounded-xl p-2 border shadow-2xs flex flex-col justify-between overflow-hidden transition-transform hover:scale-[1.02] hover:z-10"
                    style={{
                      top: `${Math.max(0, topPercent)}%`,
                      height: `${Math.max(5, heightPercent)}%`,
                      backgroundColor: color.bgHex,
                      borderColor: color.borderHex,
                    }}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-semibold text-xs text-black truncate" style={{ color: color.textHex }}>
                          {section.name}
                        </span>
                      </div>
                      <div className="font-mono text-[10px] font-medium text-neutral-600 truncate">
                        {section.id}
                      </div>
                    </div>

                    <div className="flex items-center justify-between font-mono text-[9px] text-neutral-500">
                      <span>{session.start}–{session.end}</span>
                      {section.instructor && !compact && (
                        <span className="truncate max-w-[50px]">{section.instructor}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ==========================================
// SUBCOMPONENT: DAILY AGENDA VIEW
// ==========================================
interface DayAgendaProps {
  schedule: OptimizationResult;
  activeDay: DayOfWeek;
}

const TimetableDayAgenda: React.FC<DayAgendaProps> = ({ schedule, activeDay }) => {
  const daySessions: { session: Session; section: Section }[] = [];

  for (const sec of schedule.sections) {
    for (const sess of sec.sessions) {
      if (sess.day === activeDay) {
        daySessions.push({ session: sess, section: sec });
      }
    }
  }

  // Sort by start time
  daySessions.sort((a, b) => timeToMinutes(a.session.start) - timeToMinutes(b.session.start));

  if (daySessions.length === 0) {
    return (
      <div className="p-8 text-center bg-[#FAF9F6] border border-neutral-200 rounded-2xl">
        <Coffee className="w-6 h-6 text-neutral-400 mx-auto mb-1.5" />
        <span className="text-xs font-semibold text-black block">Free Day!</span>
        <span className="text-[11px] text-neutral-500 font-light">No classes scheduled on {activeDay}.</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {daySessions.map(({ session, section }, idx) => {
        const color进 = getCourseColor(section.name, section.colorIndex);
        const prevSession = idx > 0 ? daySessions[idx - 1].session : null;
        let gapBetweenMinutes = 0;
        if (prevSession) {
          gapBetweenMinutes = timeToMinutes(session.start) - timeToMinutes(prevSession.end);
        }

        return (
          <React.Fragment key={`${section.id}-${idx}`}>
            {/* Show break gap indicator between classes */}
            {gapBetweenMinutes > 0 && (
              <div className="flex items-center gap-2 py-1 px-3 bg-[#FAF9F6] border border-dashed border-neutral-300 rounded-xl text-neutral-600 text-xs font-light">
                <Coffee className="w-3.5 h-3.5 text-neutral-500" />
                <span>
                  <strong>{formatMinutes(gapBetweenMinutes)}</strong> break / free study time
                </span>
              </div>
            )}

            <div
              className="p-4 rounded-2xl border flex items-center justify-between gap-4"
              style={{
                backgroundColor: color进.bgHex,
                borderColor: color进.borderHex,
              }}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-sm text-black" style={{ color: color进.textHex }}>
                    {section.name}
                  </h4>
                  <span className="text-xs font-mono px-1.5 py-0.5 bg-white/80 rounded text-neutral-700">
                    {section.id}
                  </span>
                </div>
                {section.instructor && (
                  <span className="text-xs text-neutral-600 font-light block mt-0.5">
                    Professor: {section.instructor}
                  </span>
                )}
              </div>

              <div className="text-right shrink-0">
                <span className="font-mono text-xs font-bold text-black block">
                  {session.start} – {session.end}
                </span>
                <span className="text-[11px] text-neutral-500 font-medium">
                  {section.credits} credits
                </span>
              </div>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
};
