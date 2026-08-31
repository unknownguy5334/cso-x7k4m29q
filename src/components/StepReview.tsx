import React, { useState, useMemo } from 'react';
import {
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Trash2,
  Plus,
  Copy,
  Users,
  ArrowRight,
  ArrowLeft,
  CheckSquare,
  Square,
  Search,
  Palette,
  Clock,
  Check,
  Edit2,
  Sparkles,
} from 'lucide-react';
import { CourseGroup, DayOfWeek, Section } from '../types';
import { timeToMinutes } from '../utils/optimizer';
import { COURSE_PALETTE, getCourseColor } from '../utils/colors';

interface StepReviewProps {
  sections: Section[];
  onUpdateSections: (updated: Section[]) => void;
  onBackToAdd: () => void;
  onContinueToPreferences: () => void;
}

export const StepReview: React.FC<StepReviewProps> = ({
  sections,
  onUpdateSections,
  onBackToAdd,
  onContinueToPreferences,
}) => {
  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Bulk selection set of section IDs
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkCreditValue, setBulkCreditValue] = useState<string>('3');
  const [showBulkCreditInput, setShowBulkCreditInput] = useState(false);

  // Active color picker popover course name
  const [activeColorPickerCourse, setActiveColorPickerCourse] = useState<string | null>(null);

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

  // Collapsed state map for course groups
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const group of courseGroups) {
      initial[group.name] = false;
    }
    return initial;
  });

  const toggleGroupCollapse = (groupName: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupName]: !prev[groupName],
    }));
  };

  // Filtered course groups based on search query
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return courseGroups;
    const q = searchQuery.toLowerCase().trim();
    return courseGroups.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        g.sections.some(
          (s) =>
            s.id.toLowerCase().includes(q) ||
            (s.instructor && s.instructor.toLowerCase().includes(q))
        )
    );
  }, [courseGroups, searchQuery]);

  // Incomplete sections
  const incompleteSectionIds = useMemo(() => {
    return sections
      .filter((s) => s.credits === null || isNaN(s.credits) || s.credits <= 0)
      .map((s) => s.id);
  }, [sections]);

  // Individual Section Updaters
  const handleUpdateCredit = (sectionId: string, value: string) => {
    const num = value === '' ? null : parseFloat(value);
    onUpdateSections(
      sections.map((s) => (s.id === sectionId ? { ...s, credits: num !== null && !isNaN(num) ? num : null } : s))
    );
  };

  const handleUpdateCourseColor = (courseName: string, colorIndex: number) => {
    onUpdateSections(
      sections.map((s) => (s.name.trim() === courseName.trim() ? { ...s, colorIndex } : s))
    );
    setActiveColorPickerCourse(null);
  };

  const handleUpdateId = (sectionId: string, newId: string) => {
    onUpdateSections(sections.map((s) => (s.id === sectionId ? { ...s, id: newId } : s)));
  };

  const handleUpdateInstructor = (sectionId: string, newInstructor: string) => {
    onUpdateSections(sections.map((s) => (s.id === sectionId ? { ...s, instructor: newInstructor } : s)));
  };

  const handleDeleteSection = (sectionId: string) => {
    onUpdateSections(sections.filter((s) => s.id !== sectionId));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(sectionId);
      return next;
    });
  };

  const handleDuplicateSection = (section: Section) => {
    const newSection: Section = {
      ...section,
      id: `${section.id} copy`,
      sessions: section.sessions.map((s) => ({ ...s })),
    };
    onUpdateSections([...sections, newSection]);
  };

  const handleAddSectionToCourse = (courseName: string) => {
    const existing = sections.filter((s) => s.name === courseName);
    const sampleCredit = existing[0]?.credits || 3;
    const sampleColor = existing[0]?.colorIndex;
    const newSection: Section = {
      id: `${courseName.substring(0, 4).toUpperCase()} 0${existing.length + 1}`,
      name: courseName,
      credits: sampleCredit,
      instructor: '',
      colorIndex: sampleColor,
      sessions: [{ day: 'MON', start: '10:00', end: '11:30' }],
    };
    onUpdateSections([...sections, newSection]);
  };

  // Shift Time Helper (+30m, -30m, +60m, -60m)
  const handleShiftCourseTime = (courseName: string, deltaMinutes: number) => {
    onUpdateSections(
      sections.map((s) => {
        if (s.name.trim() !== courseName.trim()) return s;
        return {
          ...s,
          sessions: s.sessions.map((sess) => {
            const startM = Math.max(0, Math.min(23 * 60 + 59, timeToMinutes(sess.start) + deltaMinutes));
            const endM = Math.max(0, Math.min(23 * 60 + 59, timeToMinutes(sess.end) + deltaMinutes));
            const formatM = (mins: number) => {
              const h = Math.floor(mins / 60).toString().padStart(2, '0');
              const m = (mins % 60).toString().padStart(2, '0');
              return `${h}:${m}`;
            };
            return {
              ...sess,
              start: formatM(startM),
              end: formatM(endM),
            };
          }),
        };
      })
    );
  };

  // Bulk Handlers
  const handleToggleSelectAll = () => {
    if (selectedIds.size === sections.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sections.map((s) => s.id)));
    }
  };

  const handleToggleSelectSection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleApplyBulkCredits = () => {
    const num = parseFloat(bulkCreditValue);
    if (isNaN(num) || num <= 0) return;
    onUpdateSections(
      sections.map((s) => (selectedIds.has(s.id) ? { ...s, credits: num } : s))
    );
    setShowBulkCreditInput(false);
  };

  const handleDeleteSelected = () => {
    onUpdateSections(sections.filter((s) => !selectedIds.has(s.id)));
    setSelectedIds(new Set());
  };

  const isAllValid = incompleteSectionIds.length === 0 && sections.length > 0;

  return (
    <div className="max-w-5xl mx-auto py-8 sm:py-12 px-4 sm:px-6">
      {/* Top Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-neutral-100 pb-6">
        <div>
          <span className="text-[11px] font-mono tracking-widest text-neutral-400 uppercase">Step 02 / 04</span>
          <h1 className="text-3xl sm:text-4xl font-serif text-black tracking-tight font-normal mt-1">
            Review Catalog & Assign Colors
          </h1>
          <p className="text-sm text-neutral-500 mt-1 max-w-xl font-light">
            Verify credit hours, adjust section timings, and pick custom color palettes for each course.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onBackToAdd}
            className="px-4 py-2 text-xs font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-full transition"
          >
            + Add More Courses
          </button>
        </div>
      </div>

      {/* Warning banner if missing credits */}
      {incompleteSectionIds.length > 0 && (
        <div className="mb-6 p-4 bg-amber-50/70 border border-amber-200 rounded-2xl flex items-center justify-between gap-3 text-xs text-amber-900">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>{incompleteSectionIds.length} section(s)</strong> are missing credit hours. Please enter them below before proceeding.
            </span>
          </div>
          <button
            onClick={() => {
              const el = document.getElementById(`credit-input-${incompleteSectionIds[0]}`);
              if (el) el.focus();
            }}
            className="px-3 py-1 bg-amber-200/80 hover:bg-amber-300 text-amber-900 font-semibold rounded-lg shrink-0 transition"
          >
            Fix First Issue
          </button>
        </div>
      )}

      {/* Search & Bulk Action Bar */}
      <div className="mb-6 flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#FAF9F6] p-3.5 border border-neutral-200 rounded-2xl">
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search courses or professors..."
            className="w-full pl-9 pr-3 py-1.5 bg-white border border-neutral-200 rounded-full text-xs text-black placeholder:text-neutral-400 outline-none focus:border-black"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <button
            onClick={handleToggleSelectAll}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-neutral-600 hover:text-black font-medium"
          >
            {selectedIds.size === sections.length && sections.length > 0 ? (
              <CheckSquare className="w-3.5 h-3.5 text-black" />
            ) : (
              <Square className="w-3.5 h-3.5 text-neutral-400" />
            )}
            <span>Select All ({selectedIds.size})</span>
          </button>

          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2">
              {showBulkCreditInput ? (
                <div className="flex items-center gap-1 bg-white border border-neutral-300 rounded-full px-2 py-0.5 shadow-sm">
                  <span className="text-[11px] text-neutral-500">Credits:</span>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="12"
                    value={bulkCreditValue}
                    onChange={(e) => setBulkCreditValue(e.target.value)}
                    className="w-10 px-1 py-0.5 text-xs font-mono text-center outline-none"
                  />
                  <button
                    onClick={handleApplyBulkCredits}
                    className="px-2 py-0.5 bg-black text-white text-[10px] font-semibold rounded-full hover:bg-neutral-800"
                  >
                    Apply
                  </button>
                  <button
                    onClick={() => setShowBulkCreditInput(false)}
                    className="text-neutral-400 hover:text-black text-xs px-1"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowBulkCreditInput(true)}
                  className="px-3 py-1 bg-white border border-neutral-300 hover:border-black text-black text-xs font-medium rounded-full transition shadow-xs"
                >
                  Set Credits ({selectedIds.size})
                </button>
              )}

              <button
                onClick={handleDeleteSelected}
                className="px-3 py-1 bg-neutral-200 hover:bg-red-100 hover:text-red-700 text-neutral-800 text-xs font-medium rounded-full transition"
              >
                Delete Selected
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Course Groups List */}
      <div className="space-y-4 mb-8">
        {filteredGroups.length === 0 ? (
          <div className="p-12 text-center border border-neutral-200 rounded-2xl bg-[#FAF9F6]">
            <p className="text-sm text-neutral-500">No courses match "{searchQuery}".</p>
          </div>
        ) : (
          filteredGroups.map((group) => {
            const courseColor = getCourseColor(group.name, group.colorIndex);
            const isCollapsed = collapsedGroups[group.name] || false;
            const hasIncomplete = group.sections.some(
              (s) => s.credits === null || isNaN(s.credits) || s.credits <= 0
            );

            return (
              <div
                key={group.name}
                className="bg-white border border-neutral-200 rounded-2xl shadow-xs overflow-hidden transition"
              >
                {/* Course Header Bar */}
                <div className="p-4 sm:p-5 flex items-center justify-between gap-3 bg-[#FAF9F6] border-b border-neutral-100">
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      onClick={() => toggleGroupCollapse(group.name)}
                      className="p-1 text-neutral-400 hover:text-black rounded transition"
                    >
                      {isCollapsed ? (
                        <ChevronRight className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>

                    {/* Color Swatch / Palette Button */}
                    <div className="relative">
                      <button
                        onClick={() =>
                          setActiveColorPickerCourse(
                            activeColorPickerCourse === group.name ? null : group.name
                          )
                        }
                        title="Change Course Theme Color"
                        className="w-5 h-5 rounded-full border border-black/20 shadow-xs flex items-center justify-center hover:scale-110 transition"
                        style={{ backgroundColor: courseColor.swatchHex }}
                      >
                        <Palette className="w-2.5 h-2.5 text-white mix-blend-difference" />
                      </button>

                      {/* Luxury Color Picker Popover */}
                      {activeColorPickerCourse === group.name && (
                        <div className="absolute top-7 left-0 z-50 p-3 bg-white border border-neutral-300 rounded-2xl shadow-xl w-60 animate-in fade-in">
                          <span className="block text-[10px] uppercase tracking-wider font-semibold text-neutral-500 mb-2">
                            Select Course Palette
                          </span>
                          <div className="grid grid-cols-5 gap-2">
                            {COURSE_PALETTE.map((pal, pIdx) => (
                              <button
                                key={pal.name}
                                onClick={() => handleUpdateCourseColor(group.name, pIdx)}
                                title={pal.name}
                                className={`w-8 h-8 rounded-full border flex items-center justify-center transition ${
                                  group.colorIndex === pIdx
                                    ? 'ring-2 ring-black scale-105'
                                    : 'hover:scale-105 border-neutral-200'
                                }`}
                                style={{ backgroundColor: pal.swatchHex }}
                              >
                                {group.colorIndex === pIdx && (
                                  <Check className="w-3.5 h-3.5 text-white" />
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-serif font-normal text-black truncate">
                          {group.name}
                        </h2>
                        <span className="text-[11px] font-mono px-2 py-0.5 bg-white border border-neutral-200 rounded-full text-neutral-600 font-medium">
                          {group.sections.length} {group.sections.length === 1 ? 'section' : 'sections'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Batch Tools for this course */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className="hidden sm:flex items-center gap-1 bg-white border border-neutral-200 rounded-full px-2 py-1">
                      <Clock className="w-3 h-3 text-neutral-400 ml-1" />
                      <span className="text-[10px] text-neutral-500 font-medium mr-1">Shift Time:</span>
                      <button
                        onClick={() => handleShiftCourseTime(group.name, -30)}
                        title="Shift all sections 30 minutes earlier"
                        className="text-[10px] font-mono px-1.5 py-0.5 bg-neutral-100 hover:bg-black hover:text-white rounded"
                      >
                        -30m
                      </button>
                      <button
                        onClick={() => handleShiftCourseTime(group.name, 30)}
                        title="Shift all sections 30 minutes later"
                        className="text-[10px] font-mono px-1.5 py-0.5 bg-neutral-100 hover:bg-black hover:text-white rounded"
                      >
                        +30m
                      </button>
                    </div>

                    <button
                      onClick={() => handleAddSectionToCourse(group.name)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-black bg-white hover:bg-neutral-100 border border-neutral-200 rounded-full transition"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Section</span>
                    </button>
                  </div>
                </div>

                {/* Sections in this group */}
                {!isCollapsed && (
                  <div className="divide-y divide-neutral-100 p-2 sm:p-4 space-y-2">
                    {group.sections.map((sec) => {
                      const isSelected = selectedIds.has(sec.id);
                      const isMissingCredits = sec.credits === null || isNaN(sec.credits) || sec.credits <= 0;

                      return (
                        <div
                          key={sec.id}
                          className={`p-3.5 rounded-xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                            isMissingCredits
                              ? 'bg-amber-50/40 border-amber-200'
                              : 'bg-white border-neutral-200 hover:border-neutral-300'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <button
                              onClick={() => handleToggleSelectSection(sec.id)}
                              className="text-neutral-400 hover:text-black shrink-0"
                            >
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-black" />
                              ) : (
                                <Square className="w-4 h-4" />
                              )}
                            </button>

                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <input
                                  type="text"
                                  value={sec.id}
                                  onChange={(e) => handleUpdateId(sec.id, e.target.value)}
                                  className="font-mono text-xs font-semibold text-black px-1.5 py-0.5 bg-[#FAF9F6] border border-neutral-200 rounded outline-none focus:border-black w-32"
                                />

                                <input
                                  type="text"
                                  value={sec.instructor || ''}
                                  onChange={(e) => handleUpdateInstructor(sec.id, e.target.value)}
                                  placeholder="Add Instructor"
                                  className="text-xs text-neutral-600 px-1.5 py-0.5 bg-white border border-transparent hover:border-neutral-200 focus:border-black rounded outline-none w-36 truncate"
                                />
                              </div>

                              {/* Meeting Times */}
                              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                                {sec.sessions.map((s, sIdx) => (
                                  <span
                                    key={sIdx}
                                    className="text-[10px] font-mono px-2 py-0.5 bg-[#FAF9F6] border border-neutral-200 rounded-md text-neutral-700 font-medium"
                                  >
                                    {s.day} {s.start}–{s.end}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Credits & Action Buttons */}
                          <div className="flex items-center gap-3 justify-between sm:justify-end shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-neutral-100">
                            <div className="flex items-center gap-1.5">
                              <label className="text-[11px] text-neutral-500 font-medium">Credits:</label>
                              <input
                                id={`credit-input-${sec.id}`}
                                type="number"
                                step="0.5"
                                min="0.5"
                                max="12"
                                value={sec.credits !== null && sec.credits !== undefined ? sec.credits : ''}
                                onChange={(e) => handleUpdateCredit(sec.id, e.target.value)}
                                placeholder="?"
                                className={`w-14 px-2 py-1 text-xs font-mono text-center rounded border outline-none ${
                                  isMissingCredits
                                    ? 'border-amber-400 bg-amber-100/50 text-amber-900 font-bold'
                                    : 'border-neutral-300 bg-white text-black'
                                }`}
                              />
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleDuplicateSection(sec)}
                                title="Duplicate Section"
                                className="p-1.5 text-neutral-400 hover:text-black hover:bg-neutral-100 rounded-lg transition"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteSection(sec.id)}
                                title="Delete Section"
                                className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-neutral-100 rounded-lg transition"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="flex items-center justify-between pt-4 border-t border-neutral-200">
        <button
          onClick={onBackToAdd}
          className="inline-flex items-center gap-1.5 px-6 py-2.5 text-xs font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-full transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Add Courses</span>
        </button>

        <button
          id="btn-continue-to-preferences"
          onClick={onContinueToPreferences}
          disabled={!isAllValid}
          className="inline-flex items-center gap-2 px-8 py-3 bg-black text-white text-xs font-semibold rounded-full hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm"
        >
          <span>Continue to Step 3: Preferences & Timing</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
