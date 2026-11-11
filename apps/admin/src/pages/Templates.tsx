import React, { useEffect, useState } from 'react';
import {
  GraduationCap,
  Plus,
  Trash2,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Sparkles,
  BookOpen,
  CheckSquare,
  Users,
  ChevronDown,
  ChevronUp,
  X,
  Layers,
  Power,
} from 'lucide-react';
import { adminApi } from '../api/client';
import { SubjectTemplate, SystemTaskTemplate } from '../types';
import { Badge } from '../components/Badge';

export const Templates: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'subjects' | 'tasks'>('subjects');

  // Subjects state
  const [subjects, setSubjects] = useState<SubjectTemplate[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [expandedSubjectId, setExpandedSubjectId] = useState<string | null>(null);

  // Tasks state
  const [taskTemplates, setTaskTemplates] = useState<SystemTaskTemplate[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);

  // Modals
  const [subjectModalOpen, setSubjectModalOpen] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Subject Form State
  const [subjName, setSubjName] = useState('');
  const [subjCode, setSubjCode] = useState('');
  const [subjCategory, setSubjCategory] = useState('Computer Science');
  const [subjColor, setSubjColor] = useState('#6366F1');
  const [subjCredits, setSubjCredits] = useState(3);
  const [subjDifficulty, setSubjDifficulty] = useState('intermediate');
  const [subjDesc, setSubjDesc] = useState('');
  const [units, setUnits] = useState<{ title: string; weeks: number }[]>([
    { title: 'Unit 1: Fundamentals', weeks: 2 },
  ]);
  const [submittingSubj, setSubmittingSubj] = useState(false);

  // Task Form State
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskPriority, setTaskPriority] = useState('medium');
  const [taskMinutes, setTaskMinutes] = useState(60);
  const [taskCategory, setTaskCategory] = useState('academic');
  const [subtasks, setSubtasks] = useState<{ title: string }[]>([
    { title: 'Step 1: Read syllabus guidelines' },
  ]);
  const [submittingTask, setSubmittingTask] = useState(false);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadSubjects = async () => {
    setLoadingSubjects(true);
    try {
      const res = await adminApi.getSubjectTemplates({
        category: selectedCategory || undefined,
      });
      setSubjects(res.items);
      setCategories(res.categories);
    } catch (e: unknown) {
      if (e instanceof Error) showToast(e.message, 'error');
    } finally {
      setLoadingSubjects(false);
    }
  };

  const loadTasks = async () => {
    setLoadingTasks(true);
    try {
      const res = await adminApi.getSystemTaskTemplates();
      setTaskTemplates(res);
    } catch (e: unknown) {
      if (e instanceof Error) showToast(e.message, 'error');
    } finally {
      setLoadingTasks(false);
    }
  };

  useEffect(() => {
    loadSubjects();
  }, [selectedCategory]);

  useEffect(() => {
    if (activeTab === 'tasks') {
      loadTasks();
    }
  }, [activeTab]);

  const handleSeedDefaults = async () => {
    try {
      const seeded = await adminApi.seedDefaultSubjectTemplates();
      if (seeded.length > 0) {
        showToast(`Seeded ${seeded.length} university curriculum templates!`, 'success');
        loadSubjects();
      } else {
        showToast('Starter templates are already present in PostgreSQL.', 'success');
      }
    } catch (e: unknown) {
      if (e instanceof Error) showToast(e.message, 'error');
    }
  };

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjName.trim()) return;

    setSubmittingSubj(true);
    try {
      const created = await adminApi.createSubjectTemplate({
        name: subjName.trim(),
        code: subjCode.trim() || null,
        category: subjCategory.trim() || 'General',
        color: subjColor,
        credits: subjCredits,
        difficulty_level: subjDifficulty,
        description: subjDesc.trim() || null,
        suggested_units: units.filter((u) => u.title.trim()),
      });
      setSubjects([created, ...subjects]);
      setSubjectModalOpen(false);
      setSubjName('');
      setSubjCode('');
      setSubjDesc('');
      setUnits([{ title: 'Unit 1: Fundamentals', weeks: 2 }]);
      showToast(`Subject template '${created.name}' published for student enrollment.`, 'success');
    } catch (e: unknown) {
      if (e instanceof Error) showToast(e.message, 'error');
    } finally {
      setSubmittingSubj(false);
    }
  };

  const handleDeleteSubject = async (id: string, name: string) => {
    if (!confirm(`Delete template '${name}'?`)) return;
    try {
      await adminApi.deleteSubjectTemplate(id);
      setSubjects(subjects.filter((s) => s.id !== id));
      showToast(`Subject template '${name}' deleted.`, 'success');
    } catch (e: unknown) {
      if (e instanceof Error) showToast(e.message, 'error');
    }
  };

  const handleToggleSubjectActive = async (s: SubjectTemplate) => {
    try {
      const updated = await adminApi.updateSubjectTemplate(s.id, {
        is_active: !s.is_active,
      });
      setSubjects(subjects.map((item) => (item.id === updated.id ? updated : item)));
      showToast(
        `Template '${updated.name}' is now ${updated.is_active ? 'Active' : 'Hidden from students'}.`,
        'success'
      );
    } catch (e: unknown) {
      if (e instanceof Error) showToast(e.message, 'error');
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;

    setSubmittingTask(true);
    try {
      const created = await adminApi.createSystemTaskTemplate({
        title: taskTitle.trim(),
        description: taskDesc.trim() || null,
        default_priority: taskPriority,
        estimated_minutes: taskMinutes,
        category: taskCategory,
        subtasks: subtasks.filter((st) => st.title.trim()).map((st) => ({ title: st.title.trim() })),
      });
      setTaskTemplates([created, ...taskTemplates]);
      setTaskModalOpen(false);
      setTaskTitle('');
      setTaskDesc('');
      setSubtasks([{ title: 'Step 1: Read syllabus guidelines' }]);
      showToast(`System task template '${created.title}' published.`, 'success');
    } catch (e: unknown) {
      if (e instanceof Error) showToast(e.message, 'error');
    } finally {
      setSubmittingTask(false);
    }
  };

  const handleDeleteTask = async (id: string, title: string) => {
    if (!confirm(`Delete task workflow '${title}'?`)) return;
    try {
      await adminApi.deleteSystemTaskTemplate(id);
      setTaskTemplates(taskTemplates.filter((t) => t.id !== id));
      showToast(`Task template '${title}' deleted.`, 'success');
    } catch (e: unknown) {
      if (e instanceof Error) showToast(e.message, 'error');
    }
  };

  const colorOptions = [
    '#6366F1', // Indigo
    '#0EA5E9', // Sky
    '#10B981', // Emerald
    '#F59E0B', // Amber
    '#8B5CF6', // Purple
    '#EC4899', // Pink
    '#EF4444', // Red
    '#14B8A6', // Teal
  ];

  return (
    <div className="flex-1 p-8 space-y-6 overflow-y-auto relative">
      {/* Toast Alert */}
      {toast && (
        <div
          className={`fixed top-6 right-6 z-50 px-4 py-3 rounded-xl shadow-xl border text-sm flex items-center gap-2.5 transition-all ${
            toast.type === 'success'
              ? 'bg-emerald-950 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-950 border-rose-500/30 text-rose-300'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Curated Academic Content & Templates
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Curate standard university subject syllabus templates and academic sprint workflows (AR-05)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {activeTab === 'subjects' ? (
            <>
              <button
                onClick={handleSeedDefaults}
                className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span>Seed University Starter Pack</span>
              </button>
              <button
                onClick={() => setSubjectModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition-colors shadow-lg shadow-indigo-600/30"
              >
                <Plus className="w-4 h-4" />
                <span>New Subject Template</span>
              </button>
            </>
          ) : (
            <button
              onClick={() => setTaskModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition-colors shadow-lg shadow-indigo-600/30"
            >
              <Plus className="w-4 h-4" />
              <span>New Task Workflow</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('subjects')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
            activeTab === 'subjects'
              ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Curated Subjects ({subjects.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('tasks')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
            activeTab === 'tasks'
              ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <CheckSquare className="w-3.5 h-3.5" />
          <span>System Task Workflows ({taskTemplates.length})</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 1. CURATED SUBJECTS TAB                                                   */}
      {/* ========================================================================= */}
      {activeTab === 'subjects' && (
        <div className="space-y-4">
          {/* Category Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            <button
              onClick={() => setSelectedCategory('')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                selectedCategory === ''
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              All Categories
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === cat
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Subject Cards Grid */}
          {loadingSubjects ? (
            <div className="py-16 text-center text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
              Loading curated curriculum templates...
            </div>
          ) : subjects.length === 0 ? (
            <div className="py-16 text-center text-slate-400 bg-slate-900/60 rounded-2xl border border-slate-800 p-8 space-y-3">
              <BookOpen className="w-8 h-8 mx-auto text-slate-600" />
              <p className="font-semibold text-white">No Subject Templates Yet</p>
              <p className="text-xs max-w-md mx-auto text-slate-400">
                Click "Seed University Starter Pack" to immediately populate standard university subjects (Data Structures, Calculus, AI, Chemistry, etc.)
              </p>
              <button
                onClick={handleSeedDefaults}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Seed Starter Curriculum</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {subjects.map((s) => {
                const isExpanded = expandedSubjectId === s.id;
                return (
                  <div
                    key={s.id}
                    className="bg-slate-900 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-5 flex flex-col justify-between transition-all group"
                  >
                    <div>
                      {/* Top Bar: Color Chip, Code, Status Toggle, Delete */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3.5 h-3.5 rounded-full"
                            style={{ backgroundColor: s.color }}
                          />
                          <span className="font-mono text-xs font-bold text-slate-300">
                            {s.code || 'GENERAL'}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-medium">
                            {s.category}
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleToggleSubjectActive(s)}
                            title={s.is_active ? 'Active (Visible in Mobile App)' : 'Hidden (Draft)'}
                            className={`p-1.5 rounded-lg transition-colors ${
                              s.is_active
                                ? 'text-emerald-400 hover:bg-emerald-950/40'
                                : 'text-slate-500 hover:bg-slate-800 hover:text-white'
                            }`}
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteSubject(s.id, s.name)}
                            title="Delete Template"
                            className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <h3 className="font-bold text-white text-sm mb-1.5">{s.name}</h3>
                      <p className="text-slate-400 text-xs line-clamp-2 mb-3">
                        {s.description || 'No description provided.'}
                      </p>

                      {/* Stats Pills */}
                      <div className="flex items-center gap-2 text-[11px] mb-3">
                        <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300 font-semibold">
                          {s.credits} Credits
                        </span>
                        <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-indigo-300 capitalize font-medium">
                          {s.difficulty_level}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-emerald-950/40 border border-emerald-800/40 text-emerald-300 flex items-center gap-1 font-medium">
                          <Users className="w-3 h-3" />
                          {s.enrolled_count} Enrolled
                        </span>
                      </div>
                    </div>

                    {/* Expandable Syllabus Units */}
                    <div>
                      {s.suggested_units && s.suggested_units.length > 0 && (
                        <div className="border-t border-slate-800/80 pt-2.5">
                          <button
                            onClick={() => setExpandedSubjectId(isExpanded ? null : s.id)}
                            className="w-full flex items-center justify-between text-[11px] text-slate-400 hover:text-white transition-colors"
                          >
                            <span className="flex items-center gap-1 font-medium">
                              <Layers className="w-3 h-3 text-indigo-400" />
                              {s.suggested_units.length} Syllabus Units
                            </span>
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </button>

                          {isExpanded && (
                            <div className="mt-2 space-y-1.5 bg-slate-950/80 p-2.5 rounded-xl border border-slate-800/80 max-h-40 overflow-y-auto">
                              {s.suggested_units.map((unit, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between text-[11px]"
                                >
                                  <span className="text-slate-300 truncate max-w-[200px]">
                                    {unit.title}
                                  </span>
                                  <span className="text-[10px] text-slate-500 font-mono">
                                    {unit.weeks} wks
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. SYSTEM TASK WORKFLOWS TAB                                              */}
      {/* ========================================================================= */}
      {activeTab === 'tasks' && (
        <div className="space-y-4">
          {loadingTasks ? (
            <div className="py-16 text-center text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
              Loading system task workflows...
            </div>
          ) : taskTemplates.length === 0 ? (
            <div className="py-16 text-center text-slate-400 bg-slate-900/60 rounded-2xl border border-slate-800 p-8 space-y-3">
              <CheckSquare className="w-8 h-8 mx-auto text-slate-600" />
              <p className="font-semibold text-white">No System Task Workflows</p>
              <p className="text-xs max-w-md mx-auto text-slate-400">
                Publish standard academic workflows (e.g. 7-Day Exam Sprint, Research Paper Milestones, Lab Submission) that students can import into their task board.
              </p>
              <button
                onClick={() => setTaskModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Publish First Task Workflow</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {taskTemplates.map((t) => (
                <div
                  key={t.id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge label={t.category} variant="purple" />
                        <Badge
                          label={t.default_priority}
                          variant={
                            t.default_priority === 'high'
                              ? 'danger'
                              : t.default_priority === 'medium'
                              ? 'warning'
                              : 'info'
                          }
                        />
                      </div>
                      <button
                        onClick={() => handleDeleteTask(t.id, t.title)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <h3 className="font-bold text-white text-sm">{t.title}</h3>
                    <p className="text-slate-400 text-xs mt-1">{t.description || 'No description'}</p>

                    {/* Subtasks Preview */}
                    {t.subtasks && t.subtasks.length > 0 && (
                      <div className="mt-3 bg-slate-950 p-2.5 rounded-xl border border-slate-800 space-y-1">
                        <p className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider">
                          Subtask Milestones ({t.subtasks.length})
                        </p>
                        {t.subtasks.slice(0, 4).map((st, idx) => (
                          <div key={idx} className="flex items-center gap-1.5 text-xs text-slate-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                            <span className="truncate">{st.title}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
                    <span>Est. Time: {t.estimated_minutes || 60} mins</span>
                    <span>Published: {new Date(t.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUBJECT TEMPLATE CREATION MODAL                                           */}
      {/* ========================================================================= */}
      {subjectModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-white text-base">New Curated Subject Template</h3>
              </div>
              <button
                onClick={() => setSubjectModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubject} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Subject Name *</label>
                  <input
                    type="text"
                    required
                    value={subjName}
                    onChange={(e) => setSubjName(e.target.value)}
                    placeholder="e.g. Data Structures & Algorithms"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Subject Code</label>
                  <input
                    type="text"
                    value={subjCode}
                    onChange={(e) => setSubjCode(e.target.value)}
                    placeholder="e.g. CS-201"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Category</label>
                  <input
                    type="text"
                    value={subjCategory}
                    onChange={(e) => setSubjCategory(e.target.value)}
                    placeholder="e.g. Computer Science"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Credits</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={subjCredits}
                    onChange={(e) => setSubjCredits(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Difficulty</label>
                  <select
                    value={subjDifficulty}
                    onChange={(e) => setSubjDifficulty(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>
              </div>

              {/* Color Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Theme Color</label>
                <div className="flex items-center gap-2">
                  {colorOptions.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setSubjColor(c)}
                      className={`w-6 h-6 rounded-full border-2 transition-transform ${
                        subjColor === c ? 'scale-125 border-white' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={subjDesc}
                  onChange={(e) => setSubjDesc(e.target.value)}
                  placeholder="Overview of core syllabus topics..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Dynamic Units Builder */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-300">
                    Syllabus Units & Topics ({units.length})
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setUnits([...units, { title: `Unit ${units.length + 1}: `, weeks: 2 }])
                    }
                    className="text-indigo-400 text-xs font-semibold hover:underline"
                  >
                    + Add Unit
                  </button>
                </div>

                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {units.map((u, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={u.title}
                        onChange={(e) => {
                          const updated = [...units];
                          updated[i].title = e.target.value;
                          setUnits(updated);
                        }}
                        placeholder={`Unit ${i + 1} Title`}
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                      />
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={u.weeks}
                        onChange={(e) => {
                          const updated = [...units];
                          updated[i].weeks = Number(e.target.value);
                          setUnits(updated);
                        }}
                        title="Weeks allocated"
                        className="w-16 bg-slate-950 border border-slate-800 rounded-xl px-2 py-1.5 text-xs text-white text-center focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setUnits(units.filter((_, idx) => idx !== i))}
                        className="p-1.5 text-slate-500 hover:text-rose-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setSubjectModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingSubj}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold disabled:opacity-50"
                >
                  {submittingSubj ? 'Publishing...' : 'Publish Template'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TASK WORKFLOW CREATION MODAL                                              */}
      {/* ========================================================================= */}
      {taskModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-white text-base">New System Task Workflow</h3>
              </div>
              <button
                onClick={() => setTaskModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Workflow Title *</label>
                <input
                  type="text"
                  required
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="e.g. 7-Day Final Exam Revision Sprint"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Priority</label>
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Est. Minutes</label>
                  <input
                    type="number"
                    min={15}
                    max={1440}
                    value={taskMinutes}
                    onChange={(e) => setTaskMinutes(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Category</label>
                  <input
                    type="text"
                    value={taskCategory}
                    onChange={(e) => setTaskCategory(e.target.value)}
                    placeholder="academic"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={taskDesc}
                  onChange={(e) => setTaskDesc(e.target.value)}
                  placeholder="Instructions for students when working through this milestone..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Dynamic Subtask Builder */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-300">
                    Milestone Steps ({subtasks.length})
                  </label>
                  <button
                    type="button"
                    onClick={() => setSubtasks([...subtasks, { title: '' }])}
                    className="text-indigo-400 text-xs font-semibold hover:underline"
                  >
                    + Add Step
                  </button>
                </div>
                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {subtasks.map((st, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={st.title}
                        onChange={(e) => {
                          const updated = [...subtasks];
                          updated[i].title = e.target.value;
                          setSubtasks(updated);
                        }}
                        placeholder={`Milestone Step ${i + 1}`}
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={() => setSubtasks(subtasks.filter((_, idx) => idx !== i))}
                        className="p-1.5 text-slate-500 hover:text-rose-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setTaskModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingTask}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold disabled:opacity-50"
                >
                  {submittingTask ? 'Publishing...' : 'Publish Workflow'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

