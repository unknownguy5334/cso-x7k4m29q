import {
  DayOfWeek,
  OptimizationResult,
  OptimizerOutput,
  SchedulePreferences,
  Section,
  Session,
} from '../types';

export const ALL_DAYS: DayOfWeek[] = ['SAT', 'SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI'];
export const DAYS: DayOfWeek[] = ['SAT', 'SUN', 'MON', 'TUE', 'WED', 'THU'];

export function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map((x) => parseInt(x, 10) || 0);
  return h * 60 + m;
}

export function formatMinutes(totalMinutes: number): string {
  if (totalMinutes <= 0) return '0h 00m (0 mins gap)';
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours === 0) return `${mins}m (${totalMinutes} mins)`;
  return `${hours}h ${mins.toString().padStart(2, '0')}m (${totalMinutes} mins)`;
}

export function conflicts(sessionsA: Session[], sessionsB: Session[]): boolean {
  for (const a of sessionsA) {
    const aStart = timeToMinutes(a.start);
    const aEnd = timeToMinutes(a.end);
    for (const b of sessionsB) {
      if (a.day === b.day) {
        const bStart = timeToMinutes(b.start);
        const bEnd = timeToMinutes(b.end);
        if (aStart < bEnd && bStart < aEnd) {
          return true;
        }
      }
    }
  }
  return false;
}

export const sessionsConflict = conflicts;

// Generate all combinations of array elements of length r
function* combinations<T>(arr: T[], r: number): Generator<T[]> {
  const n = arr.length;
  if (r > n || r < 0) return;
  if (r === 0) {
    yield [];
    return;
  }
  const idx = Array.from({ length: r }, (_, i) => i);
  while (true) {
    yield idx.map((i) => arr[i]);
    let i = r - 1;
    while (i >= 0 && idx[i] === n - r + i) i--;
    if (i < 0) return;
    idx[i]++;
    for (let j = i + 1; j < r; j++) {
      idx[j] = idx[j - 1] + 1;
    }
  }
}

// Cartesian product of arrays
function* cartesian<T>(arrays: T[][]): Generator<T[]> {
  if (arrays.length === 0) {
    yield [];
    return;
  }
  const [first, ...rest] = arrays;
  for (const item of first) {
    for (const restCombo of cartesian(rest)) {
      yield [item, ...restCombo];
    }
  }
}

export interface OptimizerParams {
  courses: Record<string, Section[]>; // grouped by course title
  fixedCourses: Section[]; // explicitly locked sections
  targetCredits?: number;
  preferences: SchedulePreferences;
}

export function runOptimizer({ courses, fixedCourses, preferences }: OptimizerParams): OptimizerOutput {
  const {
    targetCredits,
    useCreditRange,
    minCredits,
    maxCredits,
    mandatoryCourses = [],
    earliestStartTime = 'ANY',
    latestEndTime = 'ANY',
    freeDays = [],
    maxDays,
  } = preferences;

  // Subjects available for combinatorial selection (excluding subjects already in fixedCourses)
  const fixedSubjectNames = new Set(fixedCourses.map((s) => s.name));
  const candidateSubjects = Object.keys(courses).filter((subj) => !fixedSubjectNames.has(subj));

  // Identify mandatory candidate courses (courses marked mandatory but not fixed to a single specific section)
  const mandatoryCandidateSubjects = new Set(
    mandatoryCourses.filter((subj) => !fixedSubjectNames.has(subj) && courses[subj]?.length > 0)
  );

  // Flatten all considered sections for output reference
  const allSectionsConsidered: Section[] = [...fixedCourses];
  for (const subj of candidateSubjects) {
    allSectionsConsidered.push(...(courses[subj] || []));
  }

  // Pre-filter candidate sections by time-of-day limits
  const minStartLimitMinutes = earliestStartTime !== 'ANY' ? timeToMinutes(earliestStartTime) : null;
  const maxEndLimitMinutes = latestEndTime !== 'ANY' ? timeToMinutes(latestEndTime) : null;

  const validCourses: Record<string, Section[]> = {};
  for (const subj of candidateSubjects) {
    const list = courses[subj] || [];
    const valid = list.filter((sec) => {
      // Check sessions inside this section
      for (const sess of sec.sessions) {
        if (minStartLimitMinutes !== null && timeToMinutes(sess.start) < minStartLimitMinutes) {
          return false;
        }
        if (maxEndLimitMinutes !== null && timeToMinutes(sess.end) > maxEndLimitMinutes) {
          return false;
        }
      }
      return true;
    });
    if (valid.length > 0) {
      validCourses[subj] = valid;
    }
  }

  const validCandidateSubjects = Object.keys(validCourses);

  // Check if fixed courses themselves conflict
  let fixedConflict = false;
  for (let i = 0; i < fixedCourses.length; i++) {
    for (let j = i + 1; j < fixedCourses.length; j++) {
      if (sessionsConflict(fixedCourses[i].sessions, fixedCourses[j].sessions)) {
        fixedConflict = true;
        break;
      }
    }
    if (fixedConflict) break;
  }

  const rawResults: OptimizationResult[] = [];
  let evaluatedCount = 0;

  if (!fixedConflict) {
    // Test different subset sizes k from 0 to total valid candidate subjects
    for (let k = 0; k <= validCandidateSubjects.length; k++) {
      for (const subjectSubset of combinations(validCandidateSubjects, k)) {
        // Enforce mandatory courses requirement:
        // Every subject marked as mandatory MUST be present in the chosen subset
        if (mandatoryCandidateSubjects.size > 0) {
          const subsetSet = new Set(subjectSubset);
          let containsAllMandatory = true;
          for (const mandSubj of mandatoryCandidateSubjects) {
            if (!subsetSet.has(mandSubj)) {
              containsAllMandatory = false;
              break;
            }
          }
          if (!containsAllMandatory) {
            continue;
          }
        }

        // Collect section lists for each subject in this subset
        const sectionLists = subjectSubset.map((subj) => validCourses[subj]);

        // Evaluate every Cartesian product permutation of sections
        for (const candidateSections of cartesian(sectionLists)) {
          evaluatedCount++;
          const allSections = [...fixedCourses, ...candidateSections];

          // 1. Check Credit constraint
          const totalCredits = allSections.reduce((sum, s) => sum + (s.credits || 0), 0);
          if (useCreditRange) {
            if (totalCredits < minCredits || totalCredits > maxCredits) {
              continue;
            }
          } else {
            if (totalCredits !== targetCredits) {
              continue;
            }
          }

          // 2. Check pairwise session conflict (0 time collision)
          let hasConflict = false;
          for (let i = 0; i < allSections.length; i++) {
            for (let j = i + 1; j < allSections.length; j++) {
              if (sessionsConflict(allSections[i].sessions, allSections[j].sessions)) {
                hasConflict = true;
                break;
              }
            }
            if (hasConflict) break;
          }

          if (hasConflict) continue;

          // 3. Compute Day Schedule Metrics & Gaps
          const daySessions: Record<DayOfWeek, Session[]> = {
            SAT: [],
            SUN: [],
            MON: [],
            TUE: [],
            WED: [],
            THU: [],
            FRI: [],
          };

          let minStartMinutes = 24 * 60;
          let maxEndMinutes = 0;

          for (const s of allSections) {
            for (const sess of s.sessions) {
              if (daySessions[sess.day]) {
                daySessions[sess.day].push(sess);
                const sM = timeToMinutes(sess.start);
                const eM = timeToMinutes(sess.end);
                if (sM < minStartMinutes) minStartMinutes = sM;
                if (eM > maxEndMinutes) maxEndMinutes = eM;
              }
            }
          }

          const campusDays = ALL_DAYS.filter((d) => daySessions[d].length > 0);

          // Max campus days filter
          if (maxDays && campusDays.length > maxDays) {
            continue;
          }

          // Check if any campusDay is in requested freeDays
          if (freeDays.length > 0 && campusDays.some((d) => freeDays.includes(d))) {
            continue;
          }

          let totalGap = 0;

          for (const d of ALL_DAYS) {
            const sess = [...daySessions[d]].sort(
              (a, b) => timeToMinutes(a.start) - timeToMinutes(b.start)
            );
            if (sess.length <= 1) continue;

            for (let idx = 0; idx < sess.length - 1; idx++) {
              const gap = timeToMinutes(sess[idx + 1].start) - timeToMinutes(sess[idx].end);
              if (gap > 0) totalGap += gap;
            }
          }

          rawResults.push({
            id: `sch-${rawResults.length + 1}`,
            sections: allSections,
            days: campusDays,
            numDays: campusDays.length,
            totalGap,
            totalCredits,
            earliestStartMinutes: minStartMinutes === 24 * 60 ? 0 : minStartMinutes,
            latestEndMinutes: maxEndMinutes,
          });
        }
      }
    }
  }

  // Ranking comparator: lowest total gap time, then fewer campus days, then total credits
  const compare = (a: OptimizationResult, b: OptimizationResult) =>
    a.totalGap - b.totalGap || a.numDays - b.numDays || b.totalCredits - a.totalCredits;

  // Group by distinct day counts (e.g. 3, 4, 5, 6, 7)
  const byDayCount: Record<number, OptimizationResult[]> = {};
  const totalFoundByDay: Record<number, number> = {};

  const availableDayCounts = [3, 4, 5, 6, 7];

  for (const dayCount of availableDayCounts) {
    const subset = rawResults.filter((r) => r.numDays === dayCount).sort(compare);
    totalFoundByDay[dayCount] = subset.length;

    const rankedSubset = subset.slice(0, 15).map((r, i) => {
      const isTie =
        (i > 0 && compare(r, subset[i - 1]) === 0) ||
        (i < subset.length - 1 && compare(r, subset[i + 1]) === 0);
      return {
        ...r,
        isTie,
        tieReason: isTie ? 'Tied with another schedule on total gap time' : undefined,
      };
    });

    byDayCount[dayCount] = rankedSubset;
  }

  // Diagnostics if 0 results
  let impossibleDiagnostic: {
    reason: string;
    suggestion: string;
    actionType?: 'auto_adjust_credits' | 'clear_free_days' | 'clear_time_limits' | 'unmark_mandatory' | 'allow_credit_range';
    actionLabel?: string;
    suggestedTargetCredits?: number;
    achievableCreditSums?: number[];
    countIfRelaxed?: number;
  } | undefined;
  const diagnosticsList: string[] = [];

  if (rawResults.length === 0) {
    if (fixedConflict) {
      impossibleDiagnostic = {
        reason: 'The sections you locked conflict directly with each other on meeting days and times.',
        suggestion: 'Unlock one or more sections in Preferences to resolve the direct time collision.',
      };
      diagnosticsList.push('Locked sections contain direct schedule overlaps.');
    } else {
      // Run diagnostic simulation: test without targetCredits filter to see what valid credit totals exist
      const achievableCreditCounts = new Map<number, number>();
      for (let k = 0; k <= validCandidateSubjects.length; k++) {
        for (const subjectSubset of combinations(validCandidateSubjects, k)) {
          if (mandatoryCandidateSubjects.size > 0) {
            const subsetSet = new Set(subjectSubset);
            let containsAllMandatory = true;
            for (const mandSubj of mandatoryCandidateSubjects) {
              if (!subsetSet.has(mandSubj)) {
                containsAllMandatory = false;
                break;
              }
            }
            if (!containsAllMandatory) continue;
          }

          const sectionLists = subjectSubset.map((subj) => validCourses[subj]);
          for (const candidateSections of cartesian(sectionLists)) {
            const allSections = [...fixedCourses, ...candidateSections];

            // Pairwise conflict check
            let conflict = false;
            for (let i = 0; i < allSections.length; i++) {
              for (let j = i + 1; j < allSections.length; j++) {
                if (sessionsConflict(allSections[i].sessions, allSections[j].sessions)) {
                  conflict = true;
                  break;
                }
              }
              if (conflict) break;
            }
            if (conflict) continue;

            // Check free days
            const daySessions: Record<string, Session[]> = {};
            for (const s of allSections) {
              for (const sess of s.sessions) {
                if (!daySessions[sess.day]) daySessions[sess.day] = [];
                daySessions[sess.day].push(sess);
              }
            }
            const campusDays = ALL_DAYS.filter((d) => daySessions[d]?.length > 0);
            if (freeDays.length > 0 && campusDays.some((d) => freeDays.includes(d))) {
              continue;
            }

            const cred = allSections.reduce((sum, s) => sum + (s.credits || 0), 0);
            if (cred > 0) {
              achievableCreditCounts.set(cred, (achievableCreditCounts.get(cred) || 0) + 1);
            }
          }
        }
      }

      const achievableCredits = Array.from(achievableCreditCounts.keys()).sort((a, b) => b - a);

      if (achievableCredits.length > 0) {
        // There ARE valid conflict-free schedules, but targetCredits did not match!
        const closest = achievableCredits.reduce((prev, curr) =>
          Math.abs(curr - targetCredits) < Math.abs(prev - targetCredits) ? curr : prev
        );
        const countAtClosest = achievableCreditCounts.get(closest) || 0;

        impossibleDiagnostic = {
          reason: `Target was set to ${targetCredits} credits, but your courses form valid timetables at ${achievableCredits.join(', ')} credits.`,
          suggestion: `We found ${countAtClosest} conflict-free schedule(s) totaling ${closest} credits! Click below to automatically update your target.`,
          actionType: 'auto_adjust_credits',
          actionLabel: `Set Target to ${closest} Credits & View ${countAtClosest} Schedules`,
          suggestedTargetCredits: closest,
          achievableCreditSums: achievableCredits,
          countIfRelaxed: countAtClosest,
        };
        diagnosticsList.push(
          `Target Credits was ${targetCredits} cr, but valid credit totals available are: ${achievableCredits.join(', ')} cr.`
        );
      } else if (mandatoryCandidateSubjects.size > 1) {
        // Check if mandatory courses alone conflict
        impossibleDiagnostic = {
          reason: `The courses selected as Mandatory cannot be scheduled together without time conflicts or violating time bounds.`,
          suggestion: 'Try unmarking one or more mandatory courses or adding alternative section times for them.',
          actionType: 'unmark_mandatory',
          actionLabel: 'Clear Mandatory Course Constraints',
        };
        diagnosticsList.push('Mandatory courses could not be scheduled together without overlap.');
      } else if (freeDays.length > 0) {
        impossibleDiagnostic = {
          reason: `Your selected Free Days (${freeDays.join(', ')}) eliminated all course sections from meeting your requirements.`,
          suggestion: 'Allow classes on some of these days to find valid combinations.',
          actionType: 'clear_free_days',
          actionLabel: 'Clear Free Day Filter',
        };
        diagnosticsList.push(`Free days filter (${freeDays.join(', ')}) blocked all available sections.`);
      } else if (earliestStartTime !== 'ANY' || latestEndTime !== 'ANY') {
        impossibleDiagnostic = {
          reason: `Your time-of-day limits (Earliest: ${earliestStartTime}, Latest: ${latestEndTime}) eliminated necessary sections.`,
          suggestion: 'Reset earliest and latest time boundaries to view available schedules.',
          actionType: 'clear_time_limits',
          actionLabel: 'Reset Time Boundaries to Any Time',
        };
        diagnosticsList.push('Time-of-day limits removed required sections.');
      } else {
        impossibleDiagnostic = {
          reason: 'All section combinations have time collisions with each other.',
          suggestion: 'Add alternative sections or additional courses in Step 1 to expand timetable options.',
        };
        diagnosticsList.push('No combination of uploaded courses is free of time overlaps.');
      }
    }
  }

  return {
    allSectionsConsidered,
    byDayCount,
    totalFoundByDay,
    totalCombinationsEvaluated: evaluatedCount,
    diagnostics: diagnosticsList,
    impossibleDiagnostic,
    preferencesUsed: preferences,
  };
}
