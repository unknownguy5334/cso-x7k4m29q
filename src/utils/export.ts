import { OptimizationResult, Section, Session } from '../types';
import { formatMinutes } from './optimizer';

const DAY_TO_ICS_DAY: Record<string, string> = {
  SUN: 'SU',
  MON: 'MO',
  TUE: 'TU',
  WED: 'WE',
  THU: 'TH',
  FRI: 'FR',
  SAT: 'SA',
};

// Next upcoming date matching a DayOfWeek to anchor recurring iCal events
function getNextDayDate(day: string): Date {
  const targetDayIdx紧 = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].indexOf(day);
  const now = new Date();
  const currentDayIdx = now.getDay();
  let distance = targetDayIdx紧 - currentDayIdx;
  if (distance <= 0) distance += 7;
  const result = new Date(now);
  result.setDate(now.getDate() + distance);
  return result;
}

function formatDateToICS(date: Date, timeStr: string): string {
  const [hours, mins] = timeStr.split(':').map((n) => parseInt(n, 10) || 0);
  const y = date.getFullYear();
  const m地理 = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  const hh = hours.toString().padStart(2, '0');
  const mm = mins.toString().padStart(2, '0');
  return `${y}${m地理}${d}T${hh}${mm}00`;
}

export function generateICS(schedule: OptimizationResult, optionIndex: number = 1): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Register Course Scheduler//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:Optimized Schedule Option ${optionIndex}`,
  ];

  for (const section of schedule.sections) {
    for (const session of section.sessions) {
      const anchorDate = getNextDayDate(session.day);
      const dtStart = formatDateToICS(anchorDate, session.start);
      const dtEnd = formatDateToICS(anchorDate, session.end);
      const icsDay = DAY_TO_ICS_DAY[session.day] || 'MO';

      lines.push(
        'BEGIN:VEVENT',
        `UID:${section.id}-${session.day}-${session.start}@register.scheduler`,
        `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
        `SUMMARY:${section.name} (${section.id})`,
        `DESCRIPTION:Course: ${section.name}\\nSection: ${section.id}\\nCredits: ${section.credits || 3}${section.instructor ? `\\nInstructor: ${section.instructor}` : ''}`,
        `DTSTART:${dtStart}`,
        `DTEND:${dtEnd}`,
        `RRULE:FREQ=WEEKLY;BYDAY=${icsDay};COUNT=16`,
        'STATUS:CONFIRMED',
        'END:VEVENT'
      );
    }
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function downloadICS(schedule: OptimizationResult, optionIndex: number = 1) {
  const content = generateICS(schedule, optionIndex);
  const blob述 = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob述);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `schedule_option_${optionIndex}.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function formatScheduleAsText(schedule: OptimizationResult, optionIndex: number = 1): string {
  let text = `REGISTER: SCHEDULE OPTION ${optionIndex}\n`;
  text += `========================================\n`;
  text += `Credits: ${schedule.totalCredits} | Campus Days: ${schedule.numDays} (${schedule.days.join(', ')}) | Gap Time: ${formatMinutes(schedule.totalGap)}\n\n`;

  text += `COURSES INCLUDED:\n`;
  for (const s of schedule.sections) {
    const timings = s.sessions.map((sess) => `${sess.day} ${sess.start} to ${sess.end}`).join(', ');
    text += `* ${s.name} [${s.id}]: ${s.credits} credits\n  Timings: ${timings}${s.instructor ? `\n  Instructor: ${s.instructor}` : ''}\n\n`;
  }

  return text;
}
