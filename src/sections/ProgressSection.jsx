/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useRef, useCallback } from "react";
import { gsap, prefersReducedMotion } from "../lib/gsapSetup";
import LoadingSpinner from "../components/LoadingSpinner";

const getFileEntries = (course) => {
  if (course.fileUrls && course.fileUrls.length > 0) {
    return course.fileUrls.map((url, idx) => ({
      index: idx,
      name: course.fileNames?.[idx] || `Part ${idx + 1}`,
    }));
  }
  return [{ index: 0, name: course.fileName || course.name }];
};

const splitTagDisplay = (tag) =>
  (tag || "")
    .split(";")
    .map((t) => t.trim())
    .filter(Boolean);

// Groups PYQs by topic (section), newest year first within each group, so the panel shows
// one topic header followed by all of its PYQs instead of repeating the topic on every row.
const groupPyqsBySection = (items) => {
  const order = [];
  const bySection = new Map();
  for (const p of items) {
    const key = p.section || "Other";
    if (!bySection.has(key)) {
      bySection.set(key, []);
      order.push(key);
    }
    bySection.get(key).push(p);
  }
  return order.map((key) => [
    key,
    bySection.get(key).sort((a, b) => (b.year || 0) - (a.year || 0)),
  ]);
};

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("token")}`,
});

export default function ProgressSection({ onRedirectToBuy }) {
  const [progressCourses, setProgressCourses] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [coursesError, setCoursesError] = useState("");

  const [activeCourse, setActiveCourse] = useState(null);
  const [selectedFileIndex, setSelectedFileIndex] = useState(null);
  const [fileStats, setFileStats] = useState({}); // { [fileIndex]: { totalQuestions, totalCompleted, loading } }

  const [topics, setTopics] = useState([]);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [totalCompleted, setTotalCompleted] = useState(0);
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [topicsError, setTopicsError] = useState("");

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
        const res = await fetch("/api/progress/courses", {
          headers: authHeaders(),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load courses");
        setProgressCourses(data.courses || []);
      } catch (err) {
        console.error(err);
        setCoursesError(err.message || "Failed to load courses.");
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
    setTopicsError("");
    try {
      const res = await fetch(
        `/api/progress/topics?courseId=${courseId}&fileIndex=${fileIndex}`,
        { headers: authHeaders() },
      );
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error || "Failed to load progress data");
      setTopics(data.topics || []);
      setTotalQuestions(data.totalQuestions || 0);
      setTotalCompleted(data.totalCompleted || 0);
      return data;
    } catch (err) {
      console.error(err);
      setTopicsError(err.message || "Failed to load progress data.");
      return null;
    } finally {
      setLoadingTopics(false);
    }
  }, []);

  const fetchFilePyqs = useCallback(async (courseId, fileIndex) => {
    setPyqPanelLoading(true);
    try {
      const res = await fetch(
        `/api/progress/file-pyqs?courseId=${courseId}&fileIndex=${fileIndex}`,
        { headers: authHeaders() },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load PYQs");
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
      setFileStats((prev) => ({
        ...prev,
        [entry.index]: { ...(prev[entry.index] || {}), loading: true },
      }));
      fetch(
        `/api/progress/topics?courseId=${activeCourse._id}&fileIndex=${entry.index}`,
        { headers: authHeaders() },
      )
        .then((res) => res.json())
        .then((data) => {
          setFileStats((prev) => ({
            ...prev,
            [entry.index]: {
              totalQuestions: data.totalQuestions || 0,
              totalCompleted: data.totalCompleted || 0,
              loading: false,
            },
          }));
        })
        .catch(() => {
          setFileStats((prev) => ({
            ...prev,
            [entry.index]: {
              totalQuestions: 0,
              totalCompleted: 0,
              loading: false,
            },
          }));
        });
    });
  }, [activeCourse]);

  // Entrance fade whenever the drill-down screen changes.
  const screenKey = !activeCourse
    ? "courses"
    : selectedFileIndex === null
      ? "files"
      : "checklist";
  useEffect(() => {
    if (screenContainerRef.current && !prefersReducedMotion()) {
      // clearProps removes the inline transform once settled - otherwise it'd leave this element
      // as a containing block for any position:fixed descendant (the PYQ panel), breaking its
      // viewport-relative positioning.
      gsap.fromTo(
        screenContainerRef.current,
        { opacity: 0, y: 12 },
        {
          opacity: 1,
          y: 0,
          duration: 0.4,
          ease: "power2.out",
          clearProps: "transform",
        },
      );
    }
  }, [screenKey]);

  // Progress bar fill animation.
  useEffect(() => {
    if (!fillBarRef.current) return;
    const pct =
      totalQuestions > 0 ? (totalCompleted / totalQuestions) * 100 : 0;
    gsap.to(fillBarRef.current, {
      width: `${pct}%`,
      duration: 0.5,
      ease: "power3.out",
    });
  }, [totalCompleted, totalQuestions]);

  // PYQ panel slide in/out.
  useEffect(() => {
    if (!pyqPanelRef.current) return;
    gsap.to(pyqPanelRef.current, {
      x: pyqPanelOpen ? "0%" : "-100%",
      duration: 0.35,
      ease: "power2.out",
    });
  }, [pyqPanelOpen]);

  const handleTogglePyq = async (pyqId, currentlyCompleted) => {
    const newCompleted = !currentlyCompleted;
    setPyqPanelItems((prev) =>
      prev.map((p) =>
        p._id === pyqId ? { ...p, completed: newCompleted } : p,
      ),
    );

    try {
      const res = await fetch(`/api/progress/pyqs/${pyqId}/toggle`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ completed: newCompleted }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update PYQ");
    } catch (err) {
      console.error(err);
      setPyqPanelItems((prev) =>
        prev.map((p) =>
          p._id === pyqId ? { ...p, completed: currentlyCompleted } : p,
        ),
      );
      setTopicsError(err.message || "Failed to update PYQ.");
    }
  };

  const toggleTopicCollapsed = (topicId) => {
    setCollapsedTopics((prev) => ({ ...prev, [topicId]: !prev[topicId] }));
  };

  const handleToggle = async (topicId, question) => {
    const newCompleted = !question.completed;

    setTopics((prev) =>
      prev.map((t) =>
        t._id !== topicId
          ? t
          : {
              ...t,
              questions: t.questions.map((q) =>
                q._id === question._id ? { ...q, completed: newCompleted } : q,
              ),
            },
      ),
    );
    setTotalCompleted((prev) => prev + (newCompleted ? 1 : -1));

    if (newCompleted && rowRefs.current[question._id]) {
      gsap.fromTo(
        rowRefs.current[question._id],
        { backgroundColor: "rgba(13, 122, 86, 0.25)" },
        { backgroundColor: "rgba(13, 122, 86, 0)", duration: 0.6 },
      );
    }

    try {
      const res = await fetch(
        `/api/progress/questions/${question._id}/toggle`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({ completed: newCompleted }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update progress");
      setTotalCompleted(data.totalCompleted);
      setTotalQuestions(data.totalQuestions);

      // The matched-PYQ set can change with any completion change.
      fetchFilePyqs(activeCourse._id, selectedFileIndex);
    } catch (err) {
      console.error(err);
      setTopics((prev) =>
        prev.map((t) =>
          t._id !== topicId
            ? t
            : {
                ...t,
                questions: t.questions.map((q) =>
                  q._id === question._id
                    ? { ...q, completed: !newCompleted }
                    : q,
                ),
              },
        ),
      );
      setTotalCompleted((prev) => prev + (newCompleted ? -1 : 1));
      setTopicsError(err.message || "Failed to update progress.");
    }
  };

  if (loadingCourses) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-73px)] bg-page">
        <LoadingSpinner text="Loading your courses..." />
      </div>
    );
  }

  const percent =
    totalQuestions > 0
      ? Math.round((totalCompleted / totalQuestions) * 100)
      : 0;

  return (
    <div className="w-full max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-14 text-text-primary">
      {/* ===== Screen 1: no Progress-enabled courses ===== */}
      {!loadingCourses && progressCourses.length === 0 && (
        <div
          ref={screenContainerRef}
          className="w-full max-w-2xl mx-auto px-6 py-24 text-center"
        >
          <div className="w-14 h-14 mx-auto mb-6 rounded-2xl bg-accent-soft-bg border border-accent-soft-border flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="w-6 h-6 text-brand"
            >
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <h2 className="text-2xl font-display font-semibold text-text-primary mb-2">
            No courses yet.
          </h2>
          <p className="text-sm text-text-secondary mb-8 font-medium max-w-sm mx-auto leading-relaxed">
            Progress tracking isn't enabled for any course yet. Check back soon
            or visit the marketplace.
          </p>
          {coursesError && (
            <p className="text-status-danger-text text-xs font-semibold mb-4">
              {coursesError}
            </p>
          )}
          <button
            onClick={onRedirectToBuy}
            className="px-6 py-2.5 bg-brand hover:bg-brand-hover text-text-on-accent rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
          >
            Visit Marketplace
          </button>
        </div>
      )}

      {/* ===== Screen 2: course grid ===== */}
      {progressCourses.length > 0 && !activeCourse && (
        <div ref={screenContainerRef} className="flex flex-col gap-8 md:gap-12">
          <div className="border-b border-border-default pb-6 md:pb-10">
            <span className="text-[11px] font-sans font-bold uppercase tracking-widest text-brand block mb-2">
              Your Courses
            </span>
            <h1 className="text-3xl md:text-5xl font-display font-semibold text-text-primary tracking-tight leading-tight">
              Track your progress.
            </h1>
            <p className="text-text-secondary text-sm mt-3 font-medium max-w-lg">
              Pick a course below to view your topic-by-topic study checklist
              and related PYQs.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {progressCourses.map((course) => (
              <div
                key={course._id}
                onClick={() =>
                  course.unlocked ? setActiveCourse(course) : onRedirectToBuy()
                }
                className={`relative bg-surface border rounded-2xl overflow-hidden flex flex-col justify-between transition-all duration-300 cursor-pointer group shadow-sm ${course.unlocked ? "border-border-default hover:border-brand/40 hover:shadow-xl hover:-translate-y-0.5" : "border-border-subtle opacity-65 hover:opacity-90"}`}
              >
                <div
                  className={`h-1 w-full ${course.unlocked ? "bg-brand" : "bg-border-subtle"}`}
                />
                <div className="p-5 md:p-6 flex flex-col grow">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    {!course.unlocked && (
                      <span className="flex items-center gap-1 text-[9px] font-bold text-status-warning-text bg-status-warning-bg border border-status-warning-text/25 rounded-full px-2 py-0.5 uppercase tracking-wide shrink-0">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          className="w-2.5 h-2.5"
                        >
                          <rect
                            x="3"
                            y="11"
                            width="18"
                            height="11"
                            rx="2"
                            ry="2"
                          />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                        Locked
                      </span>
                    )}
                  </div>
                  <h3 className="font-display font-semibold text-text-primary text-sm md:text-[15px] group-hover:text-brand transition-colors leading-snug grow">
                    {course.name}
                  </h3>
                </div>
                <div className="px-5 md:px-6 pb-5 md:pb-6 pt-3 border-t border-border-default flex items-center justify-between mt-auto">
                  <span className="text-[10px] text-text-tertiary font-bold uppercase tracking-wider flex items-center gap-1">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="w-3 h-3"
                    >
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    {getFileEntries(course).length} PDF
                    {getFileEntries(course).length !== 1 ? "s" : ""}
                  </span>
                  {course.unlocked ? (
                    <span className="text-[11px] font-bold text-brand flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                      Open
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        className="w-3.5 h-3.5"
                      >
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                      </svg>
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold text-status-warning-text flex items-center gap-1">
                      Purchase to Unlock
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
        <div ref={screenContainerRef} className="flex flex-col gap-8 md:gap-12">
          <div className="border-b border-border-default pb-6 md:pb-10 flex flex-wrap items-start justify-between gap-4">
            <div>
              <span className="text-[11px] font-sans font-bold uppercase tracking-widest text-brand block mb-2">
                {activeCourse.subject}
              </span>
              <h1 className="text-2xl md:text-4xl font-display font-semibold text-text-primary tracking-tight leading-tight">
                {activeCourse.name}
              </h1>
              <p className="text-text-secondary text-sm mt-2 font-medium">
                Select a PDF to view its checklist.
              </p>
            </div>
            <button
              onClick={() => setActiveCourse(null)}
              className="px-3 py-1.5 bg-surface border border-border-default hover:border-brand/40 text-text-secondary hover:text-brand rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                className="w-3.5 h-3.5"
              >
                <polyline points="15 18 9 12 15 6" />
              </svg>
              All Courses
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {getFileEntries(activeCourse).map((entry) => {
              const stats = fileStats[entry.index];
              const pct =
                stats && stats.totalQuestions > 0
                  ? Math.round(
                      (stats.totalCompleted / stats.totalQuestions) * 100,
                    )
                  : 0;
              return (
                <div
                  key={entry.index}
                  onClick={() => setSelectedFileIndex(entry.index)}
                  className="bg-surface border border-border-default hover:border-brand/40 rounded-2xl overflow-hidden hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 cursor-pointer group shadow-sm"
                >
                  <div className="p-5 md:p-6">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <p className="font-display font-semibold text-text-primary text-sm md:text-[15px] group-hover:text-brand transition-colors leading-snug">
                        {entry.name}
                      </p>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        className="w-4 h-4 text-brand shrink-0 mt-0.5 transition-transform group-hover:translate-x-1 duration-200"
                      >
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                      </svg>
                    </div>
                    {stats && !stats.loading ? (
                      <>
                        <div className="w-full h-1.5 bg-sunken rounded-full overflow-hidden mb-1.5">
                          <div
                            className="h-full bg-brand rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="text-[11px] text-text-tertiary font-semibold tabular-nums">
                          {stats.totalCompleted}/{stats.totalQuestions} done ·{" "}
                          {pct}%
                        </p>
                      </>
                    ) : (
                      <div className="w-full h-1.5 bg-sunken rounded-full animate-pulse" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===== Screen 4: topic/question checklist ===== */}
      {activeCourse && selectedFileIndex !== null && (
        <div
          ref={screenContainerRef}
          className="relative w-full overflow-hidden"
        >
          <div
            className={`transition-[padding] duration-300 ${pyqPanelOpen ? "pl-80 sm:pl-96" : "pl-0"}`}
          >
            {/* Sticky progress bar */}
            <div className="sticky top-0 z-30 bg-page/95 backdrop-blur-md border-b border-border-default">
              <div className="max-w-4xl mx-auto px-5 md:px-6 py-3 flex items-center gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-text-primary truncate leading-none">
                    {activeCourse.name}
                    {getFileEntries(activeCourse).length > 1 && (
                      <span className="text-text-tertiary font-medium">
                        {" "}
                        ·{" "}
                        {
                          getFileEntries(activeCourse).find(
                            (e) => e.index === selectedFileIndex,
                          )?.name
                        }
                      </span>
                    )}
                  </p>
                  <div className="mt-2 w-full h-1.5 bg-sunken rounded-full overflow-hidden">
                    <div
                      ref={fillBarRef}
                      className="h-full bg-brand rounded-full"
                      style={{ width: "0%" }}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-extrabold text-brand tabular-nums">
                    {percent}%
                  </span>
                  <span className="text-[10px] text-text-tertiary font-semibold tabular-nums hidden sm:inline">
                    {totalCompleted}/{totalQuestions}
                  </span>
                  {getFileEntries(activeCourse).length > 1 && (
                    <button
                      onClick={() => setSelectedFileIndex(null)}
                      className="px-2.5 py-1 bg-surface border border-border-default hover:border-brand/40 text-text-secondary hover:text-brand rounded-lg text-[10px] font-bold transition cursor-pointer"
                    >
                      Change File
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setActiveCourse(null);
                      setSelectedFileIndex(null);
                    }}
                    className="px-2.5 py-1 bg-surface border border-border-default hover:border-brand/40 text-text-secondary hover:text-brand rounded-lg text-[10px] font-bold transition cursor-pointer flex items-center gap-1"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      className="w-3 h-3"
                    >
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                    Courses
                  </button>
                </div>
              </div>
            </div>

            {/* Topics + questions */}
            <div className="max-w-4xl mx-auto px-6 py-8 flex flex-col gap-6">
              {loadingTopics && (
                <div className="flex items-center justify-center py-16">
                  <LoadingSpinner text="Loading topics..." />
                </div>
              )}
              {!loadingTopics && topicsError && (
                <div className="p-4 bg-status-danger-bg border border-status-danger-text/25 rounded-xl text-status-danger-text text-sm font-semibold">
                  {topicsError}
                </div>
              )}
              {!loadingTopics && !topicsError && topics.length === 0 && (
                <div className="bg-surface border border-border-default rounded-xl md:rounded-2xl p-16 text-center text-text-tertiary font-medium">
                  No topics have been added for this PDF yet. Check back soon.
                </div>
              )}
              {!loadingTopics &&
                topics.map((topic) => {
                  const isCollapsed = !!collapsedTopics[topic._id];
                  const doneCount = topic.questions.filter(
                    (q) => q.completed,
                  ).length;
                  const topicPct =
                    topic.questions.length > 0
                      ? Math.round((doneCount / topic.questions.length) * 100)
                      : 0;
                  const borderAccent =
                    doneCount === 0
                      ? "border-border-default"
                      : doneCount === topic.questions.length
                        ? "border-brand"
                        : "border-brand/40";
                  return (
                    <div
                      key={topic._id}
                      className={`bg-surface border ${borderAccent} rounded-2xl overflow-hidden shadow-sm transition-colors duration-300`}
                    >
                      <button
                        onClick={() => toggleTopicCollapsed(topic._id)}
                        className="w-full px-5 py-4 border-b border-border-default flex items-center justify-between cursor-pointer hover:bg-sunken/40 transition-colors text-left"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            className={`w-3.5 h-3.5 text-text-tertiary shrink-0 transition-transform duration-200 ${isCollapsed ? "-rotate-90" : ""}`}
                          >
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                          <h3 className="font-display font-semibold text-text-primary text-sm leading-snug truncate">
                            {topic.name}
                          </h3>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-3">
                          {topicPct === 100 && (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="3"
                              className="w-3.5 h-3.5 text-brand"
                            >
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                          <span
                            className={`text-[10px] font-bold tabular-nums ${topicPct === 100 ? "text-brand" : "text-text-tertiary"}`}
                          >
                            {doneCount}/{topic.questions.length}
                          </span>
                        </div>
                      </button>
                      {!isCollapsed && (
                        <div className="divide-y divide-border-subtle">
                          {topic.questions.map((q) => (
                            <div
                              key={q._id}
                              ref={(el) => {
                                rowRefs.current[q._id] = el;
                              }}
                              className="px-5 py-4 flex items-start gap-3.5 transition-colors"
                            >
                              <button
                                onClick={() => handleToggle(topic._id, q)}
                                className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 cursor-pointer transition-all duration-200 ${q.completed ? "bg-brand border-brand scale-105" : "bg-page border-border-default hover:border-brand"}`}
                              >
                                {q.completed && (
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="white"
                                    strokeWidth="3.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="w-2.5 h-2.5"
                                  >
                                    <polyline points="20 6 9 17 4 12" />
                                  </svg>
                                )}
                              </button>
                              <div className="min-w-0 flex-1">
                                <p
                                  className={`text-[13px] leading-relaxed font-medium ${q.completed ? "text-text-tertiary line-through decoration-text-tertiary/60" : "text-text-primary"}`}
                                >
                                  {q.questionText}
                                </p>
                                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                  <span className="text-[10px] text-text-tertiary font-semibold tabular-nums">
                                    pg. {q.pageNumber}
                                  </span>
                                  {splitTagDisplay(q.tag).map((t, idx) => (
                                    <span
                                      key={idx}
                                      className="text-[9px] font-bold text-brand bg-accent-soft-bg border border-accent-soft-border rounded-full px-2 py-0.5"
                                    >
                                      {t}
                                    </span>
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
            className="fixed left-0 top-18.25 bottom-0 w-80 sm:w-96 z-40 bg-surface border-r border-border-default shadow-2xl flex flex-col"
            style={{ transform: "translateX(-100%)" }}
          >
            <div className="px-5 py-4 border-b border-border-default flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-display font-semibold text-text-primary text-sm">
                  Related PYQs
                </h3>
                {pyqPanelItems.length > 0 && (
                  <p className="text-[10px] text-text-tertiary font-medium mt-0.5">
                    {pyqPanelItems.filter((p) => p.completed).length}/
                    {pyqPanelItems.length} completed
                  </p>
                )}
              </div>
              <button
                onClick={() => setPyqPanelOpen(false)}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-sunken text-text-secondary hover:text-text-primary cursor-pointer transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="w-4 h-4"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
              {pyqPanelLoading && <LoadingSpinner text="Loading PYQs..." />}
              {!pyqPanelLoading && pyqPanelItems.length === 0 && (
                <div className="text-center pt-8">
                  <p className="text-xs text-text-tertiary font-medium leading-relaxed">
                    Complete a question to see related PYQs here.
                  </p>
                </div>
              )}
              {!pyqPanelLoading &&
                groupPyqsBySection(pyqPanelItems).map(([section, items]) => (
                  <div key={section} className="space-y-2">
                    <h4 className="text-[10px] font-bold text-brand uppercase tracking-wider px-1">
                      {section}
                    </h4>
                    <div className="flex flex-col gap-2">
                      {items.map((p) => (
                        <PyqPanelItem
                          key={p._id}
                          pyq={p}
                          onToggle={handleTogglePyq}
                        />
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
              className="fixed left-0 top-1/2 -translate-y-1/2 z-40 bg-brand hover:bg-brand-hover text-text-on-accent text-[9px] font-extrabold px-2 py-4 rounded-r-xl shadow-xl cursor-pointer transition-colors tracking-widest uppercase"
              style={{ writingMode: "vertical-rl" }}
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
    <div
      className={`border rounded-xl p-3.5 flex gap-2.5 transition-colors ${pyq.completed ? "bg-surface border-border-subtle" : "bg-sunken border-border-default"}`}
    >
      <button
        onClick={() => onToggle(pyq._id, pyq.completed)}
        className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 cursor-pointer transition-all duration-200 ${pyq.completed ? "bg-brand border-brand" : "bg-surface border-border-default hover:border-brand"}`}
      >
        {pyq.completed && (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-2.5 h-2.5"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </button>
      <span
        className={`shrink-0 mt-0.5 text-[10px] font-extrabold rounded-lg px-2 py-0.5 h-fit tabular-nums ${pyq.completed ? "bg-sunken text-text-tertiary" : "bg-accent-soft-bg text-brand border border-accent-soft-border"}`}
      >
        {pyq.year}
      </span>
      <p
        className={`text-[12px] leading-relaxed flex-1 min-w-0 ${pyq.completed ? "text-text-tertiary line-through decoration-text-tertiary/50" : "text-text-secondary"}`}
      >
        {pyq.questionText}
      </p>
    </div>
  );
}
