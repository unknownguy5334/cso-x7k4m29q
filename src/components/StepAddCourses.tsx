import React, { useState, useTransition } from 'react';
import {
  Upload,
  FileText,
  PlusCircle,
  Trash2,
  Copy,
  Sparkles,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Image as ImageIcon,
  X,
  Clock,
} from 'lucide-react';
import { DayOfWeek, Section } from '../types';
import { parsePastedText } from '../utils/parser';
import { ALL_DAYS } from '../utils/optimizer';
import { optimizeImageForOCR } from '../utils/imageOptimizer';

interface StepAddCoursesProps {
  sections: Section[];
  onAddSections: (newSections: Section[]) => void;
  onClearSections: () => void;
  onContinueToReview: () => void;
}

type TabType = 'paste' | 'screenshot' | 'manual';

const PRESET_TIME_SLOTS = [
  { label: '08:30 – 10:00 AM', start: '08:30', end: '10:00' },
  { label: '09:00 – 10:30 AM', start: '09:00', end: '10:30' },
  { label: '10:00 – 11:30 AM', start: '10:00', end: '11:30' },
  { label: '11:30 AM – 01:00 PM', start: '11:30', end: '13:00' },
  { label: '01:00 – 02:30 PM', start: '13:00', end: '14:30' },
  { label: '02:30 – 04:00 PM', start: '14:30', end: '16:00' },
  { label: '04:00 – 05:30 PM', start: '16:00', end: '17:30' },
  { label: '05:30 – 07:00 PM', start: '17:30', end: '19:00' },
];

export const StepAddCourses: React.FC<StepAddCoursesProps> = ({
  sections,
  onAddSections,
  onClearSections,
  onContinueToReview,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('paste');
  const [isPending, startTransition] = useTransition();

  // Paste Text state
  const [pasteText, setPasteText] = useState('');
  const [pasteError, setPasteError] = useState<string | null>(null);

  // Screenshot Upload state
  const [uploadedFiles, setUploadedFiles] = useState<{ id: string; file: File; preview: string; name: string }[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatusMsg, setUploadStatusMsg] = useState<string | null>(null);
  const [ocrError, setOcrError] = useState<string | null>(null);

  // Parsed Pending Approval state (shows live preview before committing)
  const [pendingParsedSections, setPendingParsedSections] = useState<Section[] | null>(null);
  const [pendingSource, setPendingSource] = useState<'paste' | 'ocr'>('paste');

  // Manual Entry state
  const [manualForms, setManualForms] = useState<
    {
      id: string;
      name: string;
      sectionCode: string;
      credits: string;
      instructor: string;
      sessions: { day: DayOfWeek; start: string; end: string }[];
    }[]
  >([
    {
      id: 'form-1',
      name: '',
      sectionCode: '',
      credits: '3',
      instructor: '',
      sessions: [
        { day: 'MON', start: '10:00', end: '11:30' },
        { day: 'WED', start: '10:00', end: '11:30' },
      ],
    },
  ]);

  // Handle Paste Extraction -> Opens Live Preview Drawer
  const handleExtractPastedText = () => {
    if (!pasteText.trim()) {
      setPasteError('Please paste your course list text into the box.');
      return;
    }

    setPasteError(null);
    startTransition(() => {
      try {
        const parsed = parsePastedText(pasteText);
        if (parsed.length === 0) {
          setPasteError(
            'We could not detect meeting times and days in the text you pasted. Please make sure days (e.g. Mon, Tue, Wed) and times (e.g. 10:00 to 11:30) are included, or use Manual Entry.'
          );
        } else {
          setPendingParsedSections(parsed);
          setPendingSource('paste');
        }
      } catch (err: any) {
        setPasteError(err.message || 'Error processing pasted text.');
      }
    });
  };

  // Handle Drag & Drop / File Select for Screenshots
  const handleFileSelect = (files: FileList | null) => {
    if (!files) return;
    const newFiles: { id: string; file: File; preview: string; name: string }[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type.startsWith('image/')) {
        const preview = URL.createObjectURL(file);
        newFiles.push({
          id: `${file.name}-${Date.now()}-${i}`,
          file,
          preview,
          name: file.name,
        });
      }
    }
    setUploadedFiles((prev) => [...prev, ...newFiles]);
  };

  const handleRemoveFile = (id: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  // Fast Process Screenshot OCR with Gemini backend + Client image compression
  const handleProcessScreenshots = async () => {
    if (uploadedFiles.length === 0) return;
    setIsUploading(true);
    setOcrError(null);
    setUploadStatusMsg('Optimizing and analyzing image with AI vision...');

    try {
      // Compress all images in parallel for ultra-fast upload
      const optimizedImages = await Promise.all(
        uploadedFiles.map(async (item) => {
          const optimized = await optimizeImageForOCR(item.file);
          return { data: optimized.base64, mimeType: optimized.mimeType };
        })
      );

      setUploadStatusMsg(`Scanning ${optimizedImages.length} screenshot(s)...`);

      const res = await fetch('/api/extract-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images: optimizedImages,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server returned ${res.status}`);
      }

      const data = await res.json();
      if (data.sections && Array.isArray(data.sections) && data.sections.length > 0) {
        setPendingParsedSections(data.sections);
        setPendingSource('ocr');
        setUploadedFiles([]);
        setUploadStatusMsg(null);
      } else {
        setOcrError('No course sections could be recognized in the image. Please make sure the text is clear or try typing them manually.');
      }
    } catch (err: any) {
      console.error(err);
      setOcrError(err.message || 'Could not process the image. Please paste text or use manual entry.');
    } finally {
      setIsUploading(false);
      setUploadStatusMsg(null);
    }
  };

  // Confirm Pending Parsed Sections into Catalog
  const handleConfirmPendingSections = () => {
    if (pendingParsedSections && pendingParsedSections.length > 0) {
      onAddSections(pendingParsedSections);
      setPendingParsedSections(null);
      setPasteText('');
    }
  };

  const handleUpdatePendingCredit = (secId: string, val: string) => {
    if (!pendingParsedSections) return;
    const num = val === '' ? null : parseFloat(val);
    setPendingParsedSections((prev) =>
      prev ? prev.map((s) => (s.id === secId ? { ...s, credits: num !== null && !isNaN(num) ? num : null } : s)) : null
    );
  };

  const handleRemovePendingSection = (secId: string) => {
    setPendingParsedSections((prev) => (prev ? prev.filter((s) => s.id !== secId) : null));
  };

  // Manual Form Handlers
  const handleAddManualForm = () => {
    setManualForms((prev) => [
      ...prev,
      {
        id: `form-${Date.now()}`,
        name: '',
        sectionCode: '',
        credits: '3',
        instructor: '',
        sessions: [
          { day: 'MON', start: '10:00', end: '11:30' },
          { day: 'WED', start: '10:00', end: '11:30' },
        ],
      },
    ]);
  };

  const handleDuplicateManualForm = (formIndex: number) => {
    const target = manualForms[formIndex];
    const duplicated = {
      ...target,
      id: `form-${Date.now()}`,
      sectionCode: target.sectionCode ? `${target.sectionCode} B` : '',
      sessions: target.sessions.map((s) => ({ ...s })),
    };
    setManualForms((prev) => [...prev.slice(0, formIndex + 1), duplicated, ...prev.slice(formIndex + 1)]);
  };

  const handleRemoveManualForm = (formIndex: number) => {
    if (manualForms.length === 1) {
      setManualForms([
        {
          id: `form-${Date.now()}`,
          name: '',
          sectionCode: '',
          credits: '3',
          instructor: '',
          sessions: [{ day: 'MON', start: '10:00', end: '11:30' }],
        },
      ]);
      return;
    }
    setManualForms((prev) => prev.filter((_, idx) => idx !== formIndex));
  };

  const handleApplyPresetSlot = (formIndex: number, sessionIndex: number, start: string, end: string) => {
    setManualForms((prev) =>
      prev.map((f, idx) =>
        idx === formIndex
          ? {
              ...f,
              sessions: f.sessions.map((s, sIdx) => (sIdx === sessionIndex ? { ...s, start, end } : s)),
            }
          : f
      )
    );
  };

  const handleAddSessionRow = (formIndex: number) => {
    setManualForms((prev) =>
      prev.map((f, idx) =>
        idx === formIndex
          ? {
              ...f,
              sessions: [...f.sessions, { day: 'THU', start: '10:00', end: '11:30' }],
            }
          : f
      )
    );
  };

  const handleRemoveSessionRow = (formIndex: number, sessionIndex: number) => {
    setManualForms((prev) =>
      prev.map((f, idx) =>
        idx === formIndex && f.sessions.length > 1
          ? {
              ...f,
              sessions: f.sessions.filter((_, sIdx) => sIdx !== sessionIndex),
            }
          : f
      )
    );
  };

  const handleSaveManualSections = () => {
    const validSections: Section[] = [];
    for (const f of manualForms) {
      if (!f.name.trim()) continue;
      validSections.push({
        id: f.sectionCode.trim() || `${f.name.substring(0, 4).toUpperCase()} ${Math.floor(Math.random() * 90 + 10)}`,
        name: f.name.trim(),
        credits: f.credits ? Math.min(17, parseFloat(f.credits)) : 3,
        instructor: f.instructor.trim() || null,
        sessions: f.sessions,
      });
    }

    if (validSections.length > 0) {
      onAddSections(validSections);
      setManualForms([
        {
          id: `form-${Date.now()}`,
          name: '',
          sectionCode: '',
          credits: '3',
          instructor: '',
          sessions: [
            { day: 'MON', start: '10:00', end: '11:30' },
            { day: 'WED', start: '10:00', end: '11:30' },
          ],
        },
      ]);
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-8 sm:py-12 px-4 sm:px-6">
      {/* Top Banner Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-neutral-100 pb-6">
        <div>
          <span className="text-[11px] font-mono tracking-widest text-neutral-400 uppercase">Step 01 / 04</span>
          <h1 className="text-3xl sm:text-4xl font-serif text-black tracking-tight font-normal mt-1">
            Add Your Course Catalog
          </h1>
          <p className="text-sm text-neutral-500 mt-1 max-w-xl font-light">
            Import or enter all available courses and sections offered this semester. We will find every 100% conflict-free schedule permutation.
          </p>
        </div>

        {/* Existing courses counter / quick jump */}
        {sections.length > 0 && (
          <div className="flex items-center gap-3 self-start md:self-auto bg-[#FAF9F6] border border-neutral-200 px-4 py-2.5 rounded-full">
            <span className="text-xs text-neutral-600 font-medium">
              <strong className="text-black font-semibold">{sections.length}</strong> sections loaded
            </span>
            <button
              id="btn-continue-review-header"
              onClick={onContinueToReview}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-black text-white text-xs font-medium rounded-full hover:bg-neutral-800 transition shadow-xs"
            >
              <span>Review & Optimize</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Primary Input Tabs */}
      <div className="bg-white border border-neutral-200 rounded-2xl shadow-xs overflow-hidden mb-8">
        <div className="flex border-b border-neutral-200 bg-[#FAF9F6]">
          <button
            id="tab-paste"
            onClick={() => setActiveTab('paste')}
            className={`flex-1 flex items-center justify-center gap-2 py-3.5 px-4 text-xs font-medium border-b-2 transition ${
              activeTab === 'paste'
                ? 'border-black text-black bg-white font-semibold'
                : 'border-transparent text-neutral-500 hover:text-black hover:bg-neutral-100/50'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Paste Text or Syllabus</span>
          </button>

          <button
            id="tab-screenshot"
            onClick={() => setActiveTab('screenshot')}
            className={`flex-1 flex items-center justify-center gap-2 py-3.5 px-4 text-xs font-medium border-b-2 transition ${
              activeTab === 'screenshot'
                ? 'border-black text-black bg-white font-semibold'
                : 'border-transparent text-neutral-500 hover:text-black hover:bg-neutral-100/50'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Upload Portal Screenshots</span>
            <span className="text-[9px] uppercase tracking-wider bg-black text-white px-1.5 py-0.5 rounded font-mono">
              Fast AI Vision
            </span>
          </button>

          <button
            id="tab-manual"
            onClick={() => setActiveTab('manual')}
            className={`flex-1 flex items-center justify-center gap-2 py-3.5 px-4 text-xs font-medium border-b-2 transition ${
              activeTab === 'manual'
                ? 'border-black text-black bg-white font-semibold'
                : 'border-transparent text-neutral-500 hover:text-black hover:bg-neutral-100/50'
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Manual Form Entry</span>
          </button>
        </div>

        <div className="p-6 sm:p-8">
          {/* TAB 1: PASTE TEXT */}
          {activeTab === 'paste' && (
            <div className="space-y-4">
              <div>
                <label htmlFor="paste-input" className="block text-xs font-semibold uppercase tracking-wider text-black mb-1">
                  Paste Schedule Text, Table Rows, or Course List
                </label>
                <p className="text-xs text-neutral-500 font-light mb-2">
                  Copy directly from Excel, your student portal, or course registration bulletin. Any format with days and times is supported.
                </p>
                <textarea
                  id="paste-input"
                  rows={8}
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder="e.g.&#10;BUS302-01  Business Ethics  (3 cr)&#10;Mon, Wed 10:00 - 11:30 AM  Prof. Miller&#10;&#10;ACT33101  Accounting Information Systems  3 cr&#10;Tuesday 14:30–16:00, Thursday 14:30–16:00"
                  className="w-full p-4 border border-neutral-200 rounded-xl font-mono text-xs focus:ring-1 focus:ring-black focus:border-black outline-none bg-[#FCFCFA] text-black leading-relaxed transition"
                />
              </div>

              {pasteError && (
                <div className="p-3 bg-neutral-100 border border-neutral-300 rounded-xl flex items-start gap-2.5 text-xs text-neutral-800">
                  <AlertCircle className="w-4 h-4 text-black shrink-0 mt-0.5" />
                  <span>{pasteError}</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <button
                  id="btn-clear-paste"
                  onClick={() => setPasteText('')}
                  className="text-xs text-neutral-500 hover:text-black underline underline-offset-4 cursor-pointer"
                >
                  Clear Text
                </button>

                <button
                  id="btn-extract-paste"
                  onClick={handleExtractPastedText}
                  disabled={!pasteText.trim() || isPending}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-black text-white text-xs font-semibold rounded-full hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-xs cursor-pointer"
                >
                  <span>{isPending ? 'Extracting Courses...' : 'Parse & Preview Courses'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: SCREENSHOT / IMAGE OCR */}
          {activeTab === 'screenshot' && (
            <div className="space-y-6">
              <div>
                <span className="block text-xs font-semibold uppercase tracking-wider text-black mb-1">
                  Upload Portal Screenshots or Schedule Photos
                </span>
                <p className="text-xs text-neutral-500 font-light mb-4">
                  Screenshots are automatically compressed and processed with high-speed vision AI to extract sections, credits, and timings in seconds.
                </p>

                {/* Dropzone */}
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleFileSelect(e.dataTransfer.files);
                  }}
                  onClick={() => document.getElementById('screenshot-file-input')?.click()}
                  className="border-2 border-dashed border-neutral-300 hover:border-black bg-[#FAF9F6] hover:bg-white rounded-2xl p-8 text-center cursor-pointer transition flex flex-col items-center justify-center group"
                >
                  <input
                    id="screenshot-file-input"
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFileSelect(e.target.files)}
                  />
                  <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center text-black mb-3 group-hover:scale-105 transition">
                    <Upload className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-semibold text-black block mb-1">
                    Click to select screenshots or drag & drop here
                  </span>
                  <span className="text-[11px] text-neutral-400 font-light">
                    Supports PNG, JPG, JPEG, WebP from mobile or desktop
                  </span>
                </div>
              </div>

              {/* Uploaded File Previews */}
              {uploadedFiles.length > 0 && (
                <div className="space-y-3">
                  <span className="text-xs font-semibold text-neutral-700 block">
                    Selected Images ({uploadedFiles.length}):
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {uploadedFiles.map((item) => (
                      <div
                        key={item.id}
                        className="relative border border-neutral-200 rounded-xl overflow-hidden group bg-neutral-50 aspect-video flex items-center justify-center"
                      >
                        <img
                          src={item.preview}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveFile(item.id);
                          }}
                          className="absolute top-1.5 right-1.5 p-1 bg-black/80 text-white rounded-full hover:bg-black transition cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                        <span className="absolute bottom-0 inset-x-0 bg-black/70 text-white text-[9px] px-2 py-0.5 truncate font-mono">
                          {item.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {ocrError && (
                <div className="p-3 bg-neutral-100 border border-neutral-300 rounded-xl flex items-start gap-2.5 text-xs text-neutral-800">
                  <AlertCircle className="w-4 h-4 text-black shrink-0 mt-0.5" />
                  <span>{ocrError}</span>
                </div>
              )}

              {uploadStatusMsg && (
                <div className="p-3 bg-[#FAF9F6] border border-neutral-200 rounded-xl flex items-center gap-2.5 text-xs text-neutral-800">
                  <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin shrink-0" />
                  <span>{uploadStatusMsg}</span>
                </div>
              )}

              <div className="flex items-center justify-end">
                <button
                  id="btn-process-screenshots"
                  onClick={handleProcessScreenshots}
                  disabled={uploadedFiles.length === 0 || isUploading}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-black text-white text-xs font-semibold rounded-full hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-xs cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isUploading ? 'Scanning Screenshots...' : 'Extract Courses with Fast AI'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: MANUAL FORM ENTRY */}
          {activeTab === 'manual' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-black">
                  Course & Section Details
                </span>
                <button
                  id="btn-add-manual-form"
                  onClick={handleAddManualForm}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-black hover:underline cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Add Another Course Box</span>
                </button>
              </div>

              <div className="space-y-4">
                {manualForms.map((form, formIdx) => (
                  <div
                    key={form.id}
                    className="p-5 bg-[#FAF9F6] border border-neutral-200 rounded-2xl space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-medium text-neutral-500">
                        Course #{formIdx + 1}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleDuplicateManualForm(formIdx)}
                          title="Duplicate Course / Add Alternative Section"
                          className="p-1.5 text-neutral-500 hover:text-black hover:bg-neutral-200 rounded-lg transition text-xs flex items-center gap-1 cursor-pointer"
                        >
                          <Copy className="w-3 h-3" />
                          <span className="text-[11px]">Duplicate</span>
                        </button>
                        <button
                          onClick={() => handleRemoveManualForm(formIdx)}
                          className="p-1.5 text-neutral-400 hover:text-black hover:bg-neutral-200 rounded-lg transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-medium text-neutral-600 mb-1">
                          Course Title *
                        </label>
                        <input
                          type="text"
                          value={form.name}
                          onChange={(e) =>
                            setManualForms((prev) =>
                              prev.map((f, idx) => (idx === formIdx ? { ...f, name: e.target.value } : f))
                            )
                          }
                          placeholder="e.g. Business Ethics"
                          className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-xs bg-white text-black outline-none focus:border-black"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-neutral-600 mb-1">
                          Section ID / Code
                        </label>
                        <input
                          type="text"
                          value={form.sectionCode}
                          onChange={(e) =>
                            setManualForms((prev) =>
                              prev.map((f, idx) => (idx === formIdx ? { ...f, sectionCode: e.target.value } : f))
                            )
                          }
                          placeholder="e.g. BUS302-01"
                          className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-xs bg-white text-black outline-none focus:border-black"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-neutral-600 mb-1">
                          Credits * (Max 17)
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          min="0.5"
                          max="17"
                          value={form.credits}
                          onChange={(e) =>
                            setManualForms((prev) =>
                              prev.map((f, idx) => (idx === formIdx ? { ...f, credits: e.target.value } : f))
                            )
                          }
                          placeholder="3"
                          className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-xs bg-white text-black outline-none focus:border-black"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-neutral-600 mb-1">
                        Instructor / Professor (Optional)
                      </label>
                      <input
                        type="text"
                        value={form.instructor}
                        onChange={(e) =>
                          setManualForms((prev) =>
                            prev.map((f, idx) => (idx === formIdx ? { ...f, instructor: e.target.value } : f))
                          )
                        }
                        placeholder="e.g. Dr. Arthur Hayes"
                        className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-xs bg-white text-black outline-none focus:border-black"
                      />
                    </div>

                    {/* Sessions meeting times */}
                    <div className="pt-2 border-t border-neutral-200/80 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-700">
                          Class Meeting Sessions
                        </span>
                        <button
                          onClick={() => handleAddSessionRow(formIdx)}
                          className="text-[11px] font-medium text-black hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <PlusCircle className="w-3 h-3" />
                          <span>Add Session Day</span>
                        </button>
                      </div>

                      {form.sessions.map((sess, sessIdx) => (
                        <div key={sessIdx} className="space-y-2 bg-white p-3 border border-neutral-200 rounded-xl">
                          <div className="flex items-center gap-2 flex-wrap">
                            <select
                              value={sess.day}
                              onChange={(e) =>
                                setManualForms((prev) =>
                                  prev.map((f, fIdx) =>
                                    fIdx === formIdx
                                      ? {
                                          ...f,
                                          sessions: f.sessions.map((s, sIdx) =>
                                            sIdx === sessIdx ? { ...s, day: e.target.value as DayOfWeek } : s
                                          ),
                                        }
                                      : f
                                  )
                                )
                              }
                              className="px-2.5 py-1.5 border border-neutral-200 rounded-lg text-xs bg-[#FAF9F6] text-black font-semibold outline-none"
                            >
                              {ALL_DAYS.map((d) => (
                                <option key={d} value={d}>
                                  {d}
                                </option>
                              ))}
                            </select>

                            <div className="flex items-center gap-1">
                              <input
                                type="time"
                                value={sess.start}
                                onChange={(e) =>
                                  setManualForms((prev) =>
                                    prev.map((f, fIdx) =>
                                      fIdx === formIdx
                                        ? {
                                            ...f,
                                            sessions: f.sessions.map((s, sIdx) =>
                                              sIdx === sessIdx ? { ...s, start: e.target.value } : s
                                            ),
                                          }
                                        : f
                                    )
                                  )
                                }
                                className="px-2 py-1 border border-neutral-200 rounded-lg text-xs bg-white text-black outline-none font-mono"
                              />
                              <span className="text-neutral-400 text-xs font-mono">to</span>
                              <input
                                type="time"
                                value={sess.end}
                                onChange={(e) =>
                                  setManualForms((prev) =>
                                    prev.map((f, fIdx) =>
                                      fIdx === formIdx
                                        ? {
                                            ...f,
                                            sessions: f.sessions.map((s, sIdx) =>
                                              sIdx === sessIdx ? { ...s, end: e.target.value } : s
                                            ),
                                          }
                                        : f
                                    )
                                  )
                                }
                                className="px-2 py-1 border border-neutral-200 rounded-lg text-xs bg-white text-black outline-none font-mono"
                              />
                            </div>

                            {form.sessions.length > 1 && (
                              <button
                                onClick={() => handleRemoveSessionRow(formIdx, sessIdx)}
                                className="p-1 text-neutral-400 hover:text-black ml-auto cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          {/* Quick 1-Click Preset Times */}
                          <div className="flex items-center gap-1.5 flex-wrap pt-1">
                            <span className="text-[10px] text-neutral-400 font-medium">Quick Slots:</span>
                            {PRESET_TIME_SLOTS.slice(0, 4).map((slot) => (
                              <button
                                key={slot.label}
                                type="button"
                                onClick={() => handleApplyPresetSlot(formIdx, sessIdx, slot.start, slot.end)}
                                className="text-[10px] px-2 py-0.5 bg-[#FAF9F6] hover:bg-black hover:text-white border border-neutral-200 rounded-md transition font-mono cursor-pointer"
                              >
                                {slot.start}–{slot.end}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-end pt-2">
                <button
                  id="btn-save-manual"
                  onClick={handleSaveManualSections}
                  disabled={!manualForms.some((f) => f.name.trim().length > 0)}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-black text-white text-xs font-semibold rounded-full hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-xs cursor-pointer"
                >
                  <span>Add Manual Courses to Catalog</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* LIVE PREVIEW / APPROVAL MODAL FOR DETECTED COURSES */}
      {pendingParsedSections && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-neutral-200 rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-6 border-b border-neutral-200 flex items-center justify-between bg-[#FAF9F6]">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
                  {pendingSource === 'ocr' ? 'AI Vision OCR Result' : 'Parsed Text Result'}
                </span>
                <h3 className="text-xl font-serif text-black font-normal">
                  Review Detected Courses ({pendingParsedSections.length} Sections Found)
                </h3>
              </div>
              <button
                onClick={() => setPendingParsedSections(null)}
                className="p-2 text-neutral-400 hover:text-black rounded-full hover:bg-neutral-200 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-3">
              <p className="text-xs text-neutral-600 font-light">
                Verify that credit hours and meeting timings were recognized accurately. You can edit any field before adding them to your semester catalog.
              </p>

              <div className="space-y-2.5">
                {pendingParsedSections.map((sec, idx) => (
                  <div
                    key={`${sec.id}-${idx}`}
                    className="p-3.5 bg-[#FAF9F6] border border-neutral-200 rounded-xl flex items-center justify-between gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-black truncate">{sec.name}</span>
                        <span className="text-[11px] font-mono px-1.5 py-0.5 bg-neutral-200/80 rounded text-neutral-700">
                          {sec.id}
                        </span>
                        {sec.instructor && (
                          <span className="text-[11px] text-neutral-500 truncate">
                            • {sec.instructor}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        {sec.sessions.map((s, sIdx) => (
                          <span
                            key={sIdx}
                            className="text-[10px] font-mono px-2 py-0.5 bg-white border border-neutral-200 rounded-md text-neutral-700"
                          >
                            {s.day} {s.start}–{s.end}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="flex items-center gap-1">
                        <label className="text-[11px] text-neutral-500 font-medium">Credits:</label>
                        <input
                          type="number"
                          step="0.5"
                          min="0.5"
                          max="17"
                          value={sec.credits !== null && sec.credits !== undefined ? sec.credits : ''}
                          onChange={(e) => handleUpdatePendingCredit(sec.id, e.target.value)}
                          placeholder="3"
                          className="w-14 px-2 py-1 border border-neutral-300 rounded text-xs font-mono text-center bg-white text-black"
                        />
                      </div>

                      <button
                        onClick={() => handleRemovePendingSection(sec.id)}
                        className="p-1.5 text-neutral-400 hover:text-black hover:bg-neutral-200 rounded-lg transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-neutral-200 flex items-center justify-between bg-[#FAF9F6]">
              <button
                onClick={() => setPendingParsedSections(null)}
                className="px-4 py-2 text-xs font-medium text-neutral-600 hover:text-black cursor-pointer"
              >
                Cancel
              </button>

              <button
                id="btn-confirm-pending-sections"
                onClick={handleConfirmPendingSections}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-black text-white text-xs font-semibold rounded-full hover:bg-neutral-800 transition shadow-xs cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Add All {pendingParsedSections.length} Sections to Catalog</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Catalog Action Navigation Bar */}
      <div className="flex items-center justify-between pt-4 border-t border-neutral-200">
        <div>
          {sections.length > 0 && (
            <button
              id="btn-clear-all-sections"
              onClick={onClearSections}
              className="text-xs text-neutral-500 hover:text-black underline underline-offset-4 cursor-pointer"
            >
              Reset / Clear All Courses
            </button>
          )}
        </div>

        <button
          id="btn-continue-to-review"
          onClick={onContinueToReview}
          disabled={sections.length === 0}
          className="inline-flex items-center gap-2 px-8 py-3 bg-black text-white text-xs font-semibold rounded-full hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-xs cursor-pointer"
        >
          <span>Continue to Step 2: Review & Color ({sections.length} Sections)</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
