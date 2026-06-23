import { useState, useEffect, useRef, useCallback } from 'react';
import gsap from 'gsap';
import LoadingSpinner from '../components/LoadingSpinner';

const getFileEntries = (course) => {
  if (course.fileUrls && course.fileUrls.length > 0) {
    return course.fileUrls.map((url, idx) => ({
      index: idx,
      name: course.fileNames?.[idx] || `Part ${idx + 1}`
    }));
  }
  return [{ index: 0, name: course.fileName || course.name }];
};

const splitTagDisplay = (tag) => (tag || '').split(';').map(t => t.trim()).filter(Boolean);

// Groups PYQs by topic (section), newest year first within each group, so the panel shows
// one topic header followed by all of its PYQs instead of repeating the topic on every row.
const groupPyqsBySection = (items) => {
  const order = [];
  const bySection = new Map();
  for (const p of items) {
    const key = p.section || 'Other';
    if (!bySection.has(key)) {
      bySection.set(key, []);
      order.push(key);
    }
    bySection.get(key).push(p);
  }
  return order.map((key) => [key, bySection.get(key).sort((a, b) => (b.year || 0) - (a.year || 0))]);
};

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

export default function ProgressSection({ onRedirectToBuy }) {
  const [progressCourses, setProgressCourses] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [coursesError, setCoursesError] = useState('');

  const [activeCourse, setActiveCourse] = useState(null);
  const [selectedFileIndex, setSelectedFileIndex] = useState(null);
  const [fileStats, setFileStats] = useState({}); // { [fileIndex]: { totalQuestions, totalCompleted, loading } }

  const [topics, setTopics] = useState([]);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [totalCompleted, setTotalCompleted] = useState(0);
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [topicsError, setTopicsError] = useState('');

  const [pyqPanelOpen, setPyqPanelOpen] = useState(false);
  const [pyqPanelLoading, setPyqPanelLoading] = useState(false);
  const [pyqPanelItems, setPyqPanelItems] = useState([]);

  const [collapsedTopics, setCollapsedTopics] = useState({});

  const screenContainerRef = useRef(null);
  const fillBarRef = useRef(null);
  const pyqPanelRef = useRef(null);
  const rowRefs = useRef({});
  const autoExpandedRef = useRef(false);

  useEffect(() => {
    const fetchProgressCourses = async () => {
      try {
        const res = await fetch('/api/progress/courses', { headers: authHeaders() });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load courses');
        setProgressCourses(data.courses || []);
      } catch (err) {
        console.error(err);
        setCoursesError(err.message || 'Failed to load courses.');
      } finally {
        setLoadingCourses(false);
      }
    };
    fetchProgressCourses();
  }, []);

  // Auto-skip the file picker for single-PDF courses.
  useEffect(() => {
    if (!activeCourse) return;
    const entries = getFileEntries(activeCourse);
    if (entries.length === 1) setSelectedFileIndex(entries[0].index);
  }, [activeCourse]);

  const fetchTopics = useCallback(async (courseId, fileIndex) => {
    setLoadingTopics(true);
    setTopicsError('');
    try {
      const res = await fetch(`/api/progress/topics?courseId=${courseId}&fileIndex=${fileIndex}`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load progress data');
      setTopics(data.topics || []);
      setTotalQuestions(data.totalQuestions || 0);
      setTotalCompleted(data.totalCompleted || 0);
      return data;
    } catch (err) {
      console.error(err);
      setTopicsError(err.message || 'Failed to load progress data.');
      return null;
    } finally {
      setLoadingTopics(false);
    }
  }, []);

  const fetchFilePyqs = useCallback(async (courseId, fileIndex) => {
    setPyqPanelLoading(true);
    try {
      const res = await fetch(`/api/progress/file-pyqs?courseId=${courseId}&fileIndex=${fileIndex}`, { headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load PYQs');
      const items = data.pyqs || [];
      setPyqPanelItems(items);
      if (items.length > 0 && !autoExpandedRef.current) {
        autoExpandedRef.current = true;
        setPyqPanelOpen(true);
      }
    } catch (err) {
      console.error(err);
      setPyqPanelItems([]);
    } finally {
      setPyqPanelLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!activeCourse || selectedFileIndex === null) return;
    autoExpandedRef.current = false;
    setPyqPanelOpen(false);
    fetchTopics(activeCourse._id, selectedFileIndex);
    fetchFilePyqs(activeCourse._id, selectedFileIndex);
  }, [activeCourse, selectedFileIndex, fetchTopics, fetchFilePyqs]);

  // Lazily fetch per-file completion badges for the file-picker screen.
  useEffect(() => {
    if (!activeCourse) return;
    const entries = getFileEntries(activeCourse);
    if (entries.length <= 1) return;

    entries.forEach((entry) => {
      setFileStats((prev) => ({ ...prev, [entry.index]: { ...(prev[entry.index] || {}), loading: true } }));
      fetch(`/api/progress/topics?courseId=${activeCourse._id}&fileIndex=${entry.index}`, { headers: authHeaders() })
        .then((res) => res.json())
        .then((data) => {
          setFileStats((prev) => ({
            ...prev,
            [entry.index]: { totalQuestions: data.totalQuestions || 0, totalCompleted: data.totalCompleted || 0, loading: false }
          }));
        })
        .catch(() => {
          setFileStats((prev) => ({ ...prev, [entry.index]: { totalQuestions: 0, totalCompleted: 0, loading: false } }));
        });
    });
  }, [activeCourse]);

  // Entrance fade whenever the drill-down screen changes.
  const screenKey = !activeCourse ? 'courses' : selectedFileIndex === null ? 'files' : 'checklist';
  useEffect(() => {
    if (screenContainerRef.current) {
      // clearProps removes the inline transform once settled - otherwise it'd leave this element
      // as a containing block for any position:fixed descendant (the PYQ panel), breaking its
      // viewport-relative positioning.
      gsap.fromTo(screenContainerRef.current, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out', clearProps: 'transform' });
    }
  }, [screenKey]);

  // Progress bar fill animation.
  useEffect(() => {
    if (!fillBarRef.current) return;
    const pct = totalQuestions > 0 ? (totalCompleted / totalQuestions) * 100 : 0;
    gsap.to(fillBarRef.current, { width: `${pct}%`, duration: 0.5, ease: 'power3.out' });
  }, [totalCompleted, totalQuestions]);

  // PYQ panel slide in/out.
  useEffect(() => {
    if (!pyqPanelRef.current) return;
    gsap.to(pyqPanelRef.current, { x: pyqPanelOpen ? '0%' : '-100%', duration: 0.35, ease: 'power2.out' });
  }, [pyqPanelOpen]);

  const handleTogglePyq = async (pyqId, currentlyCompleted) => {
    const newCompleted = !currentlyCompleted;
    setPyqPanelItems((prev) => prev.map((p) => (p._id === pyqId ? { ...p, completed: newCompleted } : p)));

    try {
      const res = await fetch(`/api/progress/pyqs/${pyqId}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ completed: newCompleted })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update PYQ');
    } catch (err) {
      console.error(err);
      setPyqPanelItems((prev) => prev.map((p) => (p._id === pyqId ? { ...p, completed: currentlyCompleted } : p)));
      setTopicsError(err.message || 'Failed to update PYQ.');
    }
  };

  const toggleTopicCollapsed = (topicId) => {
    setCollapsedTopics((prev) => ({ ...prev, [topicId]: !prev[topicId] }));
  };

  const handleToggle = async (topicId, question) => {
    const newCompleted = !question.completed;

    setTopics((prev) => prev.map((t) => (t._id !== topicId ? t : {
      ...t,
      questions: t.questions.map((q) => (q._id === question._id ? { ...q, completed: newCompleted } : q))
    })));
    setTotalCompleted((prev) => prev + (newCompleted ? 1 : -1));

    if (newCompleted && rowRefs.current[question._id]) {
      gsap.fromTo(rowRefs.current[question._id],
        { backgroundColor: 'rgba(124, 58, 237, 0.25)' },
        { backgroundColor: 'rgba(124, 58, 237, 0)', duration: 0.6 });
    }

    try {
      const res = await fetch(`/api/progress/questions/${question._id}/toggle`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ completed: newCompleted })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update progress');
      setTotalCompleted(data.totalCompleted);
      setTotalQuestions(data.totalQuestions);

      // The matched-PYQ set can change with any completion change.
      fetchFilePyqs(activeCourse._id, selectedFileIndex);
    } catch (err) {
      console.error(err);
      setTopics((prev) => prev.map((t) => (t._id !== topicId ? t : {
        ...t,
        questions: t.questions.map((q) => (q._id === question._id ? { ...q, completed: !newCompleted } : q))
      })));
      setTotalCompleted((prev) => prev + (newCompleted ? -1 : 1));
      setTopicsError(err.message || 'Failed to update progress.');
    }
  };

  if (loadingCourses) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-73px)] bg-slate-950">
        <LoadingSpinner text="Loading your courses..." />
      </div>
    );
  }

  const percent = totalQuestions > 0 ? Math.round((totalCompleted / totalQuestions) * 100) : 0;

  return (
    <div className="w-full min-h-[calc(100vh-73px)] bg-slate-950">
      {/* ===== Screen 1: no Progress-enabled courses ===== */}
      {!loadingCourses && progressCourses.length === 0 && (
        <div ref={screenContainerRef} className="w-full max-w-3xl mx-auto px-6 py-16 text-center">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12">
            <h2 className="text-xl font-extrabold text-slate-100 mb-2">No Courses Available</h2>
            <p className="text-sm text-slate-400 mb-6">Progress tracking isn't enabled for any course yet. Check back soon.</p>
            {coursesError && <p className="text-rose-400 text-xs font-semibold mb-4">{coursesError}</p>}
            <button
              onClick={onRedirectToBuy}
              className="px-5 py-2.5 bg-accent-600 hover:bg-accent-500 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
            >
              Visit Marketplace
            </button>
          </div>
        </div>
      )}

      {/* ===== Screen 2: course grid ===== */}
      {progressCourses.length > 0 && !activeCourse && (
        <div ref={screenContainerRef} className="w-full max-w-7xl mx-auto px-6 py-10 md:py-14 flex flex-col gap-8">
          <div className="border-b border-slate-800 pb-5">
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-100 tracking-tight">Progress</h1>
            <p className="text-slate-400 text-sm mt-1.5 font-medium">Pick a course to track your topic-by-topic study progress.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {progressCourses.map((course) => (
              <div
                key={course._id}
                onClick={() => course.unlocked ? setActiveCourse(course) : onRedirectToBuy()}
                className={`relative bg-slate-900/50 border rounded-2xl p-6 flex flex-col justify-between transition-all duration-200 cursor-pointer group ${course.unlocked ? 'border-slate-800 hover:border-accent-500 hover:shadow-lg hover:-translate-y-0.5' : 'border-slate-800/70 opacity-80 hover:opacity-100'}`}
              >
                {!course.unlocked && (
                  <span className="absolute top-4 right-4 flex items-center gap-1 text-[9px] font-bold text-amber-400 bg-amber-950/50 border border-amber-900/50 rounded px-2 py-0.5 uppercase tracking-wide">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3 h-3"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    Locked
                  </span>
                )}
                <div className="space-y-3">
                  <span className="text-[9px] font-bold text-accent-400 bg-accent-950/50 border border-accent-900/50 rounded px-2.5 py-0.5 uppercase tracking-wide">
                    {course.subject}
                  </span>
                  <h3 className="font-bold text-slate-100 text-sm group-hover:text-accent-400 transition-colors leading-relaxed">{course.name}</h3>
                </div>
                <div className="pt-6 mt-6 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 font-semibold uppercase">
                    {getFileEntries(course).length} File{getFileEntries(course).length !== 1 ? 's' : ''}
                  </span>
                  {course.unlocked ? (
                    <span className="text-xs font-bold text-accent-400 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                      View Progress
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-amber-400 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                      Purchase to Unlock
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== Screen 3: file picker ===== */}
      {activeCourse && selectedFileIndex === null && (
        <div ref={screenContainerRef} className="w-full max-w-5xl mx-auto px-6 py-10 md:py-14 flex flex-col gap-8">
          <div className="border-b border-slate-800 pb-5 flex items-center justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-slate-100 tracking-tight">{activeCourse.name}</h1>
              <p className="text-slate-400 text-sm mt-1.5 font-medium">Pick a PDF to view its topics and questions.</p>
            </div>
            <button onClick={() => setActiveCourse(null)} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold cursor-pointer">
              Switch Course
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {getFileEntries(activeCourse).map((entry) => {
              const stats = fileStats[entry.index];
              const pct = stats && stats.totalQuestions > 0 ? Math.round((stats.totalCompleted / stats.totalQuestions) * 100) : 0;
              return (
                <div
                  key={entry.index}
                  onClick={() => setSelectedFileIndex(entry.index)}
                  className="bg-slate-900/50 border border-slate-800 hover:border-accent-500 rounded-2xl p-5 flex items-center justify-between hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-slate-100 text-sm truncate group-hover:text-accent-400">{entry.name}</p>
                    {stats && !stats.loading ? (
                      <p className="text-[11px] text-slate-500 mt-1">{stats.totalCompleted}/{stats.totalQuestions} questions completed ({pct}%)</p>
                    ) : (
                      <p className="text-[11px] text-slate-600 mt-1">Loading progress...</p>
                    )}
                  </div>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4 text-accent-400 flex-shrink-0"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===== Screen 4: topic/question checklist ===== */}
      {activeCourse && selectedFileIndex !== null && (
        <div ref={screenContainerRef} className="relative w-full overflow-hidden">
        <div className={`transition-[padding] duration-300 ${pyqPanelOpen ? 'pl-80 sm:pl-96' : 'pl-0'}`}>
          {/* Sticky progress bar */}
          <div className="sticky top-0 z-30 bg-slate-950/95 backdrop-blur border-b border-slate-800 px-6 py-4">
            <div className="max-w-4xl mx-auto flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs">
                <div className="font-bold text-slate-100 truncate">
                  {activeCourse.name}
                  {getFileEntries(activeCourse).length > 1 && (
                    <span className="text-slate-500 font-medium"> · {getFileEntries(activeCourse).find(e => e.index === selectedFileIndex)?.name}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="font-bold text-accent-400">{totalCompleted}/{totalQuestions} ({percent}%)</span>
                  {getFileEntries(activeCourse).length > 1 && (
                    <button onClick={() => setSelectedFileIndex(null)} className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[10px] font-bold cursor-pointer">Change File</button>
                  )}
                  <button onClick={() => { setActiveCourse(null); setSelectedFileIndex(null); }} className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[10px] font-bold cursor-pointer">Switch Course</button>
                </div>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div ref={fillBarRef} className="h-full bg-accent-500 rounded-full" style={{ width: '0%' }} />
              </div>
            </div>
          </div>

          {/* Topics + questions */}
          <div className="max-w-4xl mx-auto px-6 py-8 flex flex-col gap-6">
            {loadingTopics && (
              <div className="flex items-center justify-center py-16"><LoadingSpinner text="Loading topics..." /></div>
            )}
            {!loadingTopics && topicsError && (
              <div className="p-4 bg-rose-950/20 border border-rose-900/40 rounded-xl text-rose-400 text-sm font-semibold">{topicsError}</div>
            )}
            {!loadingTopics && !topicsError && topics.length === 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-16 text-center text-slate-500">
                No topics have been added for this PDF yet. Check back soon.
              </div>
            )}
            {!loadingTopics && topics.map((topic) => {
              const isCollapsed = !!collapsedTopics[topic._id];
              return (
              <div key={topic._id} className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden">
                <button
                  onClick={() => toggleTopicCollapsed(topic._id)}
                  className="w-full px-5 py-3.5 border-b border-slate-800 flex items-center justify-between cursor-pointer hover:bg-slate-900/80 transition-colors text-left"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`w-3.5 h-3.5 text-slate-500 flex-shrink-0 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`}><polyline points="6 9 12 15 18 9"/></svg>
                    <h3 className="font-bold text-slate-100 text-sm truncate">{topic.name}</h3>
                  </div>
                  <span className="text-[10px] text-slate-500 font-semibold uppercase flex-shrink-0 ml-3">
                    {topic.questions.filter(q => q.completed).length}/{topic.questions.length} done
                  </span>
                </button>
                {!isCollapsed && (
                <div className="divide-y divide-slate-800">
                  {topic.questions.map((q) => (
                    <div
                      key={q._id}
                      ref={(el) => { rowRefs.current[q._id] = el; }}
                      className="px-5 py-3.5 flex items-start gap-3"
                    >
                      <button
                        onClick={() => handleToggle(topic._id, q)}
                        className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 cursor-pointer transition-all ${q.completed ? 'bg-accent-600 border-accent-600' : 'bg-slate-950 border-slate-700 hover:border-accent-500'}`}
                      >
                        {q.completed && (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3"><polyline points="20 6 9 17 4 12"/></svg>
                        )}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-medium ${q.completed ? 'text-slate-500 line-through' : 'text-slate-200'}`}>{q.questionText}</p>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className="text-[10px] text-slate-500 font-semibold">Pg. {q.pageNumber}</span>
                          {splitTagDisplay(q.tag).map((t, idx) => (
                            <span key={idx} className="text-[9px] font-bold text-accent-400 bg-accent-950/40 border border-accent-900/40 rounded px-1.5 py-0.5">{t}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                )}
              </div>
              );
            })}
          </div>
        </div>

          {/* Persistent left PYQ panel */}
          <div
            ref={pyqPanelRef}
            className="fixed left-0 top-[73px] bottom-0 w-80 sm:w-96 z-40 bg-slate-900 border-r border-slate-800 shadow-2xl flex flex-col"
            style={{ transform: 'translateX(-100%)' }}
          >
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
              <h3 className="font-bold text-slate-100 text-sm">Related PYQs</h3>
              <button onClick={() => setPyqPanelOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
              {pyqPanelLoading && <LoadingSpinner text="Loading PYQs..." />}
              {!pyqPanelLoading && pyqPanelItems.length === 0 && (
                <p className="text-xs text-slate-500">Complete a question to see related PYQs here.</p>
              )}
              {!pyqPanelLoading && groupPyqsBySection(pyqPanelItems).map(([section, items]) => (
                <div key={section} className="space-y-2">
                  <h4 className="text-[11px] font-bold text-accent-300 bg-accent-950/30 border border-accent-900/40 rounded-lg px-2.5 py-1.5 leading-snug">
                    {section}
                  </h4>
                  <div className="flex flex-col gap-2">
                    {items.map((p) => (
                      <PyqPanelItem key={p._id} pyq={p} onToggle={handleTogglePyq} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Always-available expand tab when the panel is collapsed */}
          {!pyqPanelOpen && (
            <button
              onClick={() => setPyqPanelOpen(true)}
              className="fixed left-0 top-1/2 -translate-y-1/2 z-40 bg-accent-600 hover:bg-accent-500 text-white text-[10px] font-bold px-2 py-3 rounded-r-lg shadow-lg cursor-pointer"
              style={{ writingMode: 'vertical-rl' }}
            >
              PYQs
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function PyqPanelItem({ pyq, onToggle }) {
  return (
    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 flex gap-2.5">
      <button
        onClick={() => onToggle(pyq._id, pyq.completed)}
        className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 cursor-pointer transition-all ${pyq.completed ? 'bg-accent-600 border-accent-600' : 'bg-slate-950 border-slate-700 hover:border-accent-500'}`}
      >
        {pyq.completed && (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3"><polyline points="20 6 9 17 4 12"/></svg>
        )}
      </button>
      <span className={`flex-shrink-0 mt-0.5 text-xs font-extrabold rounded-lg px-2 py-0.5 h-fit ${pyq.completed ? 'bg-slate-900 text-slate-500' : 'bg-accent-600/20 text-accent-300 border border-accent-600/40'}`}>
        {pyq.year}
      </span>
      <p className={`text-xs leading-relaxed flex-1 min-w-0 ${pyq.completed ? 'text-slate-500 line-through' : 'text-slate-300'}`}>{pyq.questionText}</p>
    </div>
  );
}
