export type DayOfWeek = 'SAT' | 'SUN' | 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI';

export interface Session {
  id?: string;
  day: DayOfWeek;
  start: string; // "HH:MM" 24h format, e.g. "09:00"
  end: string;   // "HH:MM" 24h format, e.g. "10:30"
}

export interface Section {
  id: string; // Unique section identifier, e.g. "BUS302-New02"
  name: string; // Course name/title, e.g. "Business Ethics"
  credits: number | null; // e.g. 3, or null if missing from extraction
  sessions: Session[];
  instructor?: string | null;
  otherInstructors?: string[]; // collapsed instructor variants
  isLocked?: boolean;
  colorIndex?: number; // custom user-selected color palette index
}

export interface CourseGroup {
  name: string;
  sections: Section[];
  colorIndex?: number;
}

export interface OptimizationResult {
  id: string;
  sections: Section[];
  days: DayOfWeek[];
  numDays: number;
  totalGap: number; // in minutes
  totalCredits: number;
  earliestStartMinutes: number;
  latestEndMinutes: number;
  isTie?: boolean;
  tieReason?: string;
  isFavorite?: boolean;
}

export interface SchedulePreferences {
  targetCredits: number;
  useCreditRange: boolean;
  minCredits: number;
  maxCredits: number;
  mandatoryCourses?: string[]; // courseNames that MUST be included in every generated schedule
  lockedSectionIds: Record<string, string>; // courseName -> sectionId ("" means no lock)
  earliestStartTime: string; // "ANY", "08:00", "08:30", "09:00", "10:00"
  latestEndTime: string; // "ANY", "16:00", "17:00", "18:00", "19:00"
  freeDays: DayOfWeek[]; // e.g. ['FRI', 'MON']
  maxDays: number | null; // e.g. 3, 4, 5 or null (any)
  preferCompactDays?: boolean;
}

export interface OptimizerOutput {
  allSectionsConsidered: Section[];
  byDayCount: {
    [key: number]: OptimizationResult[];
  };
  totalFoundByDay: {
    [key: number]: number;
  };
  totalCombinationsEvaluated: number;
  diagnostics?: string[];
  impossibleDiagnostic?: {
    reason: string;
    suggestion: string;
    actionType?: 'auto_adjust_credits' | 'clear_free_days' | 'clear_time_limits' | 'unmark_mandatory' | 'allow_credit_range';
    actionLabel?: string;
    suggestedTargetCredits?: number;
    achievableCreditSums?: number[];
    countIfRelaxed?: number;
  };
  preferencesUsed?: SchedulePreferences;
}

export type AppStep = 'add' | 'review' | 'preferences' | 'results';

export interface ParseWarning {
  field: string;
  message: string;
}
