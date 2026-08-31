import { DayOfWeek, Section, Session } from '../types';

const DAY_MAP: Record<string, DayOfWeek> = {
  sat: 'SAT',
  saturday: 'SAT',
  sa: 'SAT',
  s: 'SAT',
  sun: 'SUN',
  sunday: 'SUN',
  su: 'SUN',
  u: 'SUN',
  mon: 'MON',
  monday: 'MON',
  m: 'MON',
  mo: 'MON',
  tue: 'TUE',
  tues: 'TUE',
  tuesday: 'TUE',
  t: 'TUE',
  tu: 'TUE',
  wed: 'WED',
  wednesday: 'WED',
  w: 'WED',
  we: 'WED',
  thu: 'THU',
  thur: 'THU',
  thurs: 'THU',
  thursday: 'THU',
  r: 'THU',
  th: 'THU',
  fri: 'FRI',
  friday: 'FRI',
  f: 'FRI',
  fr: 'FRI',
};

// Normalize time strings (e.g., "1:00 PM", "13:00", "8:30am", "2:30") to "HH:MM" 24-hour
export function normalizeTime(raw: string, isPMContext?: boolean): string | null {
  if (!raw) return null;
  const clean = raw.trim().toLowerCase();

  const isPM = clean.includes('pm') || clean.includes('p.m.') || (isPMContext ?? false);
  const isAM = clean.includes('am') || clean.includes('a.m.');

  const numPart = clean.replace(/[^\d:]/g, '');
  if (!numPart) return null;

  let hours = 0;
  let minutes = 0;

  if (numPart.includes(':')) {
    const parts = numPart.split(':');
    hours = parseInt(parts[0], 10);
    minutes = parseInt(parts[1], 10) || 0;
  } else {
    // e.g. "1300" or "8"
    const val = parseInt(numPart, 10);
    if (val > 100) {
      hours = Math.floor(val / 100);
      minutes = val % 100;
    } else {
      hours = val;
      minutes = 0;
    }
  }

  if (isNaN(hours) || isNaN(minutes)) return null;

  if (isPM && hours < 12) {
    hours += 12;
  } else if (isAM && hours === 12) {
    hours = 0;
  } else if (!isAM && !isPM && hours < 8) {
    // If ambiguous like 1:00, 2:30, 3:00, 4:00, usually afternoon in university context
    hours += 12;
  }

  const hh = hours.toString().padStart(2, '0');
  const mm = minutes.toString().padStart(2, '0');
  return `${hh}:${mm}`;
}

// Parse time range string like "1:00–2:30 PM", "11:30 - 13:00", "08:30 - 10:00"
export function parseTimeRange(rangeStr: string): { start: string; end: string } | null {
  const parts = rangeStr.split(/[-–—to]/i).map((s) => s.trim()).filter(Boolean);
  if (parts.length < 2) return null;

  const rawEnd = parts[1];
  const rawStart = parts[0];

  const hasEndPM = rawEnd.toLowerCase().includes('pm');
  const hasEndAM = rawEnd.toLowerCase().includes('am');

  const end = normalizeTime(rawEnd);
  // If start doesn't specify AM/PM, infer from end time if end is PM and start hour <= end hour
  const start = normalizeTime(rawStart, hasEndPM && !hasEndAM ? true : undefined);

  if (start && end) {
    return { start, end };
  }
  return null;
}

// Parse day abbreviations or tokens into array of DayOfWeek
export function parseDays(dayString: string): DayOfWeek[] {
  if (!dayString) return [];
  const clean = dayString.trim();

  // Try standard abbreviations like "MWF", "TR", "ST", "MW", "UTH"
  const specialPatterns: Record<string, DayOfWeek[]> = {
    'mwf': ['MON', 'WED', 'FRI'],
    'mw': ['MON', 'WED'],
    'tr': ['TUE', 'THU'],
    'th': ['THU'],
    'tth': ['TUE', 'THU'],
    'st': ['SAT', 'TUE'],
    'su-th': ['SUN', 'MON', 'TUE', 'WED', 'THU'],
    'm-f': ['MON', 'TUE', 'WED', 'THU', 'FRI'],
  };

  const lower = clean.toLowerCase().replace(/[\s,/&]/g, '');
  if (specialPatterns[lower]) {
    return specialPatterns[lower];
  }

  // Split by commas, slashes, spaces, hyphens
  const tokens = clean.split(/[,/&\s-]+/).map((t) => t.trim().toLowerCase()).filter(Boolean);
  const result: DayOfWeek[] = [];

  for (const token of tokens) {
    if (DAY_MAP[token] && !result.includes(DAY_MAP[token])) {
      result.push(DAY_MAP[token]);
    }
  }

  // Fallback check for single letters like M W F if not matched
  if (result.length === 0 && clean.length <= 5) {
    for (const char of clean.toUpperCase()) {
      if (char === 'M' && !result.includes('MON')) result.push('MON');
      if (char === 'T' && !result.includes('TUE')) result.push('TUE');
      if (char === 'W' && !result.includes('WED')) result.push('WED');
      if (char === 'R' && !result.includes('THU')) result.push('THU');
      if (char === 'F' && !result.includes('FRI')) result.push('FRI');
      if (char === 'S' && !result.includes('SAT')) result.push('SAT');
      if (char === 'U' && !result.includes('SUN')) result.push('SUN');
    }
  }

  return result;
}

// Client-side parser for pasted text / tables
export function parsePastedText(rawText: string): Section[] {
  if (!rawText || !rawText.trim()) return [];

  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const sections: Section[] = [];

  // Check if text is TSV (tab separated)
  const isTSV = lines.some((l) => l.includes('\t'));

  if (isTSV) {
    // Process as tab-separated spreadsheet copy
    for (let i = 0; i < lines.length; i++) {
      const cols = lines[i].split('\t').map((c) => c.trim());
      if (cols.length < 2) continue;

      // Skip header rows if detected
      if (i === 0 && cols.some((c) => /course|code|section|subject|title|credits|time|days/i.test(c))) {
        continue;
      }

      let id = cols[0] || `SEC-${i + 1}`;
      let name = cols[1] || cols[0];
      let credits: number | null = null;
      let instructor: string | null = null;
      const sessions: Session[] = [];

      // Scan other columns for credits, times, instructors
      for (let c = 1; c < cols.length; c++) {
        const val = cols[c];
        // Credits check (e.g. "3", "3.0", "4 cr")
        const creditMatch = val.match(/^(\d+(\.\d+)?)\s*(cr|credits|units)?$/i);
        if (creditMatch && credits === null) {
          credits = parseFloat(creditMatch[1]);
          continue;
        }

        // Time / Day check
        const timeMatch = val.match(/(\d{1,2}:\d{2}.*?[-–—to].*?\d{1,2}:\d{2}(?:\s*[ap]m)?)/i);
        if (timeMatch) {
          const timeRange = parseTimeRange(timeMatch[1]);
          if (timeRange) {
            // Find days in this column or previous column
            const daysFound = parseDays(val);
            if (daysFound.length > 0) {
              for (const d of daysFound) {
                sessions.push({ day: d, start: timeRange.start, end: timeRange.end });
              }
            } else if (c > 0) {
              // check previous column for days
              const prevDays = parseDays(cols[c - 1]);
              if (prevDays.length > 0) {
                for (const d of prevDays) {
                  sessions.push({ day: d, start: timeRange.start, end: timeRange.end });
                }
              }
            }
          }
        }
      }

      if (sessions.length > 0 || name.length > 0) {
        sections.push({
          id,
          name,
          credits,
          instructor,
          sessions: sessions.length > 0 ? sessions : [{ day: 'MON', start: '09:00', end: '10:30' }],
        });
      }
    }

    if (sections.length > 0) return sections;
  }

  // Unstructured / Multi-line format parser
  let currentSection: Partial<Section> | null = null;

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];

    // Check for section code / course name heading like:
    // "BUS302-New02 — Business Ethics" or "ACT33101 - Accounting for Financial Institutions"
    const headingMatch = line.match(/^([A-Z0-9_-]{3,12})\s*[-—:]\s*(.+)$/i);
    const codeOnlyMatch = line.match(/^([A-Z]{2,5}\s*\d{3,4}[A-Z0-9_-]*)$/i);

    // Check for credit specification in line
    const creditsMatch = line.match(/(\d+(\.\d+)?)\s*(credits?|credit\s*hours?|cr|units?)/i);
    const parsedCredits = creditsMatch ? parseFloat(creditsMatch[1]) : null;

    // Check for day/time patterns
    // e.g., "Tuesday-Wednesday, T:2:30–4:00, W:11:30–1:00"
    // e.g., "Sun 1:00–2:30 PM"
    // e.g., "Mon, Wed 10:00 - 11:30"
    const hasTime = /\d{1,2}:\d{2}/.test(line);

    if (headingMatch || (codeOnlyMatch && !currentSection?.id)) {
      if (currentSection && currentSection.name && (currentSection.sessions?.length ?? 0) > 0) {
        sections.push({
          id: currentSection.id || `SEC-${sections.length + 1}`,
          name: currentSection.name,
          credits: currentSection.credits ?? null,
          instructor: currentSection.instructor || null,
          sessions: currentSection.sessions || [],
        });
      }

      const id = headingMatch ? headingMatch[1].trim() : line.trim();
      const name = headingMatch ? headingMatch[2].replace(/\s*\(\d+\s*cr.*\)/i, '').trim() : line.trim();

      currentSection = {
        id,
        name,
        credits: parsedCredits,
        sessions: [],
      };
    } else if (hasTime && currentSection) {
      if (parsedCredits !== null && currentSection.credits === null) {
        currentSection.credits = parsedCredits;
      }

      // Check if line contains per-day specific times e.g. "T:2:30–4:00, W:11:30–1:00"
      const perDayMatches = Array.from(line.matchAll(/([A-Za-z]+)\s*[:]\s*(\d{1,2}:\d{2}\s*[-–—to]\s*\d{1,2}:\d{2}(?:\s*[ap]m)?)/gi));

      if (perDayMatches.length > 0) {
        for (const match of perDayMatches) {
          const dList = parseDays(match[1]);
          const tRange = parseTimeRange(match[2]);
          if (tRange && dList.length > 0) {
            for (const d of dList) {
              currentSection.sessions!.push({ day: d, start: tRange.start, end: tRange.end });
            }
          }
        }
      } else {
        // Standard "Day(s) TimeRange"
        const timeRangeMatch = line.match(/(\d{1,2}:\d{2}\s*(?:am|pm)?\s*[-–—to]\s*\d{1,2}:\d{2}\s*(?:am|pm)?)/i);
        if (timeRangeMatch) {
          const tRange = parseTimeRange(timeRangeMatch[1]);
          const beforeTime = line.substring(0, timeRangeMatch.index);
          const days = parseDays(beforeTime);

          if (tRange && days.length > 0) {
            for (const d of days) {
              currentSection.sessions!.push({ day: d, start: tRange.start, end: tRange.end });
            }
          }
        }
      }
    } else if (currentSection && parsedCredits !== null && currentSection.credits === null) {
      currentSection.credits = parsedCredits;
    } else if (currentSection && /instructor|prof|dr\./i.test(line)) {
      currentSection.instructor = line.replace(/instructor\s*[:]/i, '').trim();
    }
  }

  // Push last section
  if (currentSection && currentSection.name && (currentSection.sessions?.length ?? 0) > 0) {
    sections.push({
      id: currentSection.id || `SEC-${sections.length + 1}`,
      name: currentSection.name,
      credits: currentSection.credits ?? null,
      instructor: currentSection.instructor || null,
      sessions: currentSection.sessions || [],
    });
  }

  return sections;
}
