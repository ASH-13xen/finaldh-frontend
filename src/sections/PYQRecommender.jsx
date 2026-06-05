import { useState, useEffect, useRef } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';

const SUBJECT_NAMES = {
  'GS-1': 'GS-1: Culture, History, Geography, Society',
  'GS-2': 'GS-2: Governance, Constitution, Polity, Social Justice',
  'GS-3': 'GS-3: Science & Tech, Economic Dev, Bio-diversity, Security',
  'GS-4': 'GS-4: Ethics, Integrity & Aptitude',
};

const OPTIONAL_NAMES = {
  OptionalSubjectAgriculture: 'Optional: Agriculture',
  OptionalSubjectAnimalHusbandryAndVeterinaryScience: 'Optional: Animal Husbandry & Veterinary Science',
  OptionalSubjectAnthropology: 'Optional: Anthropology',
  OptionalSubjectBotany: 'Optional: Botany',
  OptionalSubjectChemistry: 'Optional: Chemistry',
  OptionalSubjectCivilEngineering: 'Optional: Civil Engineering',
  OptionalSubjectCommerceAndAccountancy: 'Optional: Commerce & Accountancy',
  OptionalSubjectEconomics: 'Optional: Economics',
  OptionalSubjectElectricalEngineering: 'Optional: Electrical Engineering',
  OptionalSubjectGeography: 'Optional: Geography',
  OptionalSubjectGeology: 'Optional: Geology',
  OptionalSubjectHistory: 'Optional: History',
  OptionalSubjectLaw: 'Optional: Law',
  OptionalSubjectMangement: 'Optional: Management',
  OptionalSubjectMathematics: 'Optional: Mathematics',
  OptionalSubjectMechanicalEngineering: 'Optional: Mechanical Engineering',
  OptionalSubjectMedicalScience: 'Optional: Medical Science',
  OptionalSubjectPhilosophy: 'Optional: Philosophy',
  OptionalSubjectPhysics: 'Optional: Physics',
  OptionalSubjectPoliticalScienceAndInternationalRelations: 'Optional: Political Science & International Relations',
  OptionalSubjectPsychology: 'Optional: Psychology',
  OptionalSubjectPublicAdministration: 'Optional: Public Administration',
  OptionalSubjectSociology: 'Optional: Sociology',
  OptionalSubjectStatistics: 'Optional: Statistics',
  OptionalSubjectZoology: 'Optional: Zoology'
};

export default function PYQRecommender({ selectedCourseId, onRedirectToBuy }) {
  const [purchasedCourses, setPurchasedCourses] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [activeCourse, setActiveCourse] = useState(null);

  // PDF Page controls
  const [pageInput, setPageInput] = useState('1');
  const [activePage, setActivePage] = useState(1);

  const [pdfDocument, setPdfDocument] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [pdfLoading, setPdfLoading] = useState(false);
  const scrollContainerRef = useRef(null);
  const pageRefs = useRef({});

  // Recommendations and Analysis States
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  // PYQ storage and recommendations
  const [allQuestions, setAllQuestions] = useState([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [recommendedQuestions, setRecommendedQuestions] = useState([]);

  // Fetch purchased courses
  useEffect(() => {
    const fetchPurchased = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoadingCourses(false);
        return;
      }

      try {
        const res = await fetch('/api/courses/purchased', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          const list = data.purchasedCourses || [];
          setPurchasedCourses(list);

          // If a course ID was passed via redirect, select it
          if (list.length > 0) {
            const preselected = selectedCourseId 
              ? list.find(c => c._id === selectedCourseId) 
              : null;
            if (preselected) {
              setActiveCourse(preselected);
            }
          }
        }
      } catch (err) {
        console.error('Error fetching purchased courses:', err);
      } finally {
        setLoadingCourses(false);
      }
    };

    fetchPurchased();
  }, [selectedCourseId]);

  // Load PDF.js library dynamically from CDN
  useEffect(() => {
    if (window.pdfjsLib) return;

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js';
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
      if (activeCourse) {
        loadPDFDoc(activeCourse.fileUrl);
      }
    };
    document.head.appendChild(script);
  }, []);

  const loadPDFDoc = async (url) => {
    setPdfLoading(true);
    setPdfDocument(null);
    setNumPages(0);
    try {
      const loadingTask = window.pdfjsLib.getDocument(url);
      const pdf = await loadingTask.promise;
      setPdfDocument(pdf);
      setNumPages(pdf.numPages);
    } catch (err) {
      console.error('Error loading PDF document:', err);
    } finally {
      setPdfLoading(false);
    }
  };

  // Re-load PDF when activeCourse changes
  useEffect(() => {
    if (!activeCourse) {
      setPdfDocument(null);
      setNumPages(0);
      return;
    }

    if (window.pdfjsLib) {
      loadPDFDoc(activeCourse.fileUrl);
    }
  }, [activeCourse]);

  // Set up intersection observer to detect current page in scroll viewport
  useEffect(() => {
    if (!pdfDocument || numPages === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const pageNum = parseInt(entry.target.getAttribute('data-page'), 10);
            setActivePage(pageNum);
            setPageInput(String(pageNum));
          }
        });
      },
      {
        root: scrollContainerRef.current,
        threshold: 0.35,
      }
    );

    const currentRefs = pageRefs.current;
    Object.keys(currentRefs).forEach((key) => {
      if (currentRefs[key]) {
        observer.observe(currentRefs[key]);
      }
    });

    return () => {
      observer.disconnect();
    };
  }, [pdfDocument, numPages]);

  // Fetch all PYQs in the background once to allow local filtering
  useEffect(() => {
    const fetchAllQuestions = async () => {
      setLoadingQuestions(true);
      try {
        const res = await fetch('/api/questions/list');
        if (res.ok) {
          const data = await res.json();
          setAllQuestions(data.questions || []);
        }
      } catch (err) {
        console.error('Error loading PYQs list:', err);
      } finally {
        setLoadingQuestions(false);
      }
    };
    fetchAllQuestions();
  }, []);

  // Update page number and scroll container to target page
  const handleGoToPage = (e) => {
    e.preventDefault();
    const num = parseInt(pageInput, 10);
    if (!isNaN(num) && num > 0 && num <= numPages) {
      setActivePage(num);
      const targetEl = pageRefs.current[num];
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      setErrorMsg('');
      setAnalysisResult(null);
      setRecommendedQuestions([]);
    } else {
      setErrorMsg(`Please enter a valid page number (1 to ${numPages || 1}).`);
    }
  };

  // Perform Gemini analysis on current page text
  const handleAnalyzePage = async () => {
    if (!activeCourse) return;

    setAnalyzing(true);
    setErrorMsg('');
    setAnalysisResult(null);
    setRecommendedQuestions([]);

    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/courses/analyze-page', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          courseId: activeCourse._id,
          pageNumber: activePage
        })
      });

      const contentType = res.headers.get('content-type');
      let data = {};
      if (contentType && contentType.includes('application/json')) {
        data = await res.json();
      } else {
        throw new Error(`Server error: status code ${res.status}`);
      }

      if (!res.ok) {
        throw new Error(data.error || 'Page analysis failed');
      }

      const result = data.analysis;
      setAnalysisResult(result);

      // Filter global PYQ questions based on returned tags
      if (result.section && result.title) {
        const matches = allQuestions.filter(q => {
          const matchesSubject = q.subject === activeCourse.subject;
          
          // Match section and topic (case-insensitive and soft-matching)
          const qSec = (q.tags?.section || '').toLowerCase();
          const qTitle = (q.tags?.title || '').toLowerCase();
          const rSec = (result.section || '').toLowerCase();
          const rTitle = (result.title || '').toLowerCase();

          const matchesSection = qSec.includes(rSec) || rSec.includes(qSec);
          const matchesTitle = qTitle.includes(rTitle) || rTitle.includes(qTitle);

          return matchesSubject && (matchesSection || matchesTitle);
        });

        setRecommendedQuestions(matches);
      }
    } catch (err) {
      console.error('Analysis error:', err);
      setErrorMsg(err.message || 'Error occurred during AI page analysis.');
    } finally {
      setAnalyzing(false);
    }
  };

  if (loadingCourses) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-73px)] bg-slate-50">
        <LoadingSpinner text="Retrieving course details..." />
      </div>
    );
  }

  // Handle case where user hasn't bought any courses
  if (purchasedCourses.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-73px)] bg-slate-50 px-4">
        <div className="w-full max-w-md bg-white border border-slate-200/80 rounded-2xl p-8 shadow-sm text-center">
          <div className="flex items-center justify-center w-12 h-12 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-xl mx-auto mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-6 h-6"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
          </div>
          <h2 className="text-xl font-bold text-slate-900 leading-snug">No Purchased Courses</h2>
          <p className="text-sm text-slate-500 mt-2 font-medium">You need to purchase a study package before using the AI PDF Analyzer and PYQ Recommender.</p>
          <button 
            onClick={onRedirectToBuy} 
            className="mt-6 w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
          >
            Visit Marketplace
          </button>
        </div>
      </div>
    );
  }

  // Handle case where user hasn't selected a course yet (show grid catalog first)
  if (!activeCourse) {
    return (
      <div className="w-full max-w-7xl mx-auto px-6 py-10 md:py-14 flex flex-col gap-8">
        <div className="border-b border-slate-100 pb-5">
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-6 h-6 text-indigo-650"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
            PDF Analyzer & PYQ Recommender
          </h1>
          <p className="text-slate-500 text-sm mt-1.5 font-medium">Select a purchased study package to open in the interactive workspace and start analyzing questions page-by-page.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {purchasedCourses.map((course) => {
            const isGS = course.subject.startsWith('GS-');
            const subjectDisplay = isGS ? SUBJECT_NAMES[course.subject] || course.subject : OPTIONAL_NAMES[course.subject] || course.subject;
            return (
              <div 
                key={course._id} 
                className="bg-white border border-slate-200 hover:border-indigo-400 rounded-2xl p-6 flex flex-col justify-between hover:shadow-md transition-all duration-300 group cursor-pointer"
                onClick={() => {
                  setActiveCourse(course);
                  setPageInput('1');
                  setActivePage(1);
                  setAnalysisResult(null);
                  setRecommendedQuestions([]);
                  setErrorMsg('');
                }}
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold text-indigo-650 bg-indigo-50 border border-indigo-100 rounded px-2.5 py-0.5 uppercase tracking-wide">
                      {course.subject}
                    </span>
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    </div>
                  </div>
                  
                  <div className="space-y-1.5">
                    <h3 className="font-bold text-slate-900 text-sm group-hover:text-indigo-600 transition-colors leading-relaxed line-clamp-2">
                      {course.name || course.fileName}
                    </h3>
                    <p className="text-[10px] text-slate-400 font-medium truncate">
                      Subject: {subjectDisplay}
                    </p>
                  </div>
                </div>

                <div className="pt-6 mt-6 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] text-slate-450 font-semibold uppercase">PDF E-Book</span>
                  <span className="text-xs font-bold text-indigo-650 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                    Analyze Course
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const activeSubjectName = activeCourse ? (SUBJECT_NAMES[activeCourse.subject] || OPTIONAL_NAMES[activeCourse.subject] || activeCourse.subject) : '';

  return (
    <div className="w-full max-w-7xl mx-auto px-6 py-8 flex flex-col gap-6">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-6 h-6 text-indigo-600"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
            PYQ Recommender
          </h1>
          <p className="text-slate-500 text-sm mt-1 font-medium">Read textbook PDFs and get real-time PYQ recommendations from same syllabus topics.</p>
        </div>
        
        {/* Switch and Selector Dropdown */}
        <div className="flex items-center gap-3">
          <button 
            type="button"
            onClick={() => {
              setActiveCourse(null);
              setAnalysisResult(null);
              setRecommendedQuestions([]);
              setErrorMsg('');
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-250 rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
            Switch Course
          </button>

          <div className="flex items-center gap-2 bg-white border border-slate-200/80 rounded-xl px-3 py-1.5 shadow-sm">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Reading:</span>
            <select 
              value={activeCourse?._id || ''} 
              onChange={(e) => {
                const selected = purchasedCourses.find(c => c._id === e.target.value);
                setActiveCourse(selected);
                setPageInput('1');
                setActivePage(1);
                setAnalysisResult(null);
                setRecommendedQuestions([]);
                setErrorMsg('');
              }}
              className="text-xs font-semibold text-slate-700 bg-transparent border-0 focus:outline-none focus:ring-0 cursor-pointer max-w-[250px] truncate"
            >
              {purchasedCourses.map(course => (
                <option key={course._id} value={course._id}>{course.name || course.fileName}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Workspace Split Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        
        {/* Left Column: Recommendations & AI Insights (1/3 width) */}
        <div className="lg:col-span-4 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col gap-6 h-[720px] overflow-y-auto">
          <div>
            <h2 className="text-sm font-extrabold text-slate-900 tracking-tight flex items-center gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4 text-indigo-650"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              AI Insights & PYQs
            </h2>
            <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Syllabus tagging and related past exam questions.</p>
          </div>

          {/* Prompt / Analysis State */}
          {!analysisResult && !analyzing && !errorMsg && (
            <div className="flex-grow flex flex-col items-center justify-center text-center p-6 text-slate-405 border border-dashed border-slate-150 rounded-xl bg-slate-50/50">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-10 h-10 mb-3 text-slate-300"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A5 5 0 0 0 8 8"/><path d="M12 18h.01"/></svg>
              <h3 className="text-xs font-semibold text-slate-500">No Active Analysis</h3>
              <p className="text-[10px] text-slate-400 mt-1 leading-relaxed max-w-[220px]">Navigate to the page you want to parse in the reader and click "Understand it deeply" to trigger AI topic extraction.</p>
            </div>
          )}

          {analyzing && (
            <div className="flex-grow flex flex-col items-center justify-center text-center p-6">
              <LoadingSpinner text="AI is parsing page text and tagging syllabus..." />
            </div>
          )}

          {errorMsg && (
            <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-xs font-semibold flex items-start gap-2.5 leading-relaxed">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4 text-rose-500 mt-0.5 flex-shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <span>{errorMsg}</span>
            </div>
          )}

          {analysisResult && (
            <div className="space-y-6 flex-grow flex flex-col justify-start">
              {/* Identified Concept */}
              <div className="p-4 bg-indigo-50/50 border border-indigo-100/60 rounded-xl space-y-2">
                <span className="text-[9px] font-bold text-indigo-700 uppercase tracking-wider bg-indigo-50 border border-indigo-100 rounded px-1.5 py-0.5">Identified Topic</span>
                <h4 className="text-xs font-bold text-slate-800 leading-relaxed">
                  {analysisResult.questionText}
                </h4>
                <div className="pt-2 flex flex-wrap gap-2 text-[9px] font-bold text-indigo-900">
                  <span className="bg-white border border-indigo-100 rounded px-2 py-0.5 truncate max-w-[150px]" title={analysisResult.section}>SEC: {analysisResult.section}</span>
                  <span className="bg-white border border-indigo-100 rounded px-2 py-0.5 truncate max-w-[150px]" title={analysisResult.title}>TOPIC: {analysisResult.title}</span>
                </div>
              </div>

              {/* Recommended PYQ List */}
              <div className="space-y-4 flex-grow flex flex-col justify-start">
                <h3 className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>Recommended PYQs</span>
                  <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full font-semibold">{recommendedQuestions.length} Found</span>
                </h3>

                {loadingQuestions ? (
                  <div className="py-8 text-center">
                    <LoadingSpinner text="Filtering syllabus database..." />
                  </div>
                ) : recommendedQuestions.length === 0 ? (
                  <div className="text-center p-8 text-slate-450 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-8 h-8 mx-auto mb-2 text-slate-350"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                    <p className="text-[10px] font-semibold text-slate-500">No matching past questions (PYQs) found.</p>
                    <p className="text-[9px] text-slate-400 mt-0.5 leading-relaxed">No exact questions are registered under this syllabus tag yet.</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                    {recommendedQuestions.map((q) => (
                      <div key={q._id} className="p-3 bg-slate-55/35 border border-slate-200 rounded-xl hover:border-indigo-300 hover:bg-white hover:shadow-sm transition-all duration-300 space-y-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[8px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 rounded px-1.5 py-0.2">
                            {q.subject}
                          </span>
                          <span className="text-[8px] font-semibold text-slate-450 bg-slate-50 border border-slate-150 rounded px-1 py-0.2">
                            Year {q.year}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-700 leading-relaxed font-semibold">
                          {q.text}
                        </p>
                        <div className="border-t border-slate-100/60 pt-2 flex flex-wrap gap-1.5 text-[8px] font-semibold text-slate-400">
                          <span className="bg-slate-50 px-1.5 py-0.5 rounded truncate max-w-[100px]" title={q.tags?.section}>S: {q.tags?.section}</span>
                          <span className="bg-slate-50 px-1.5 py-0.5 rounded truncate max-w-[100px]" title={q.tags?.title}>T: {q.tags?.title}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: PDF Viewer and controls (2/3 width) */}
        <div className="lg:col-span-8 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col gap-4 h-[720px]">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-800 bg-slate-50 border border-slate-150 rounded px-2 py-1 select-none">
                {activeCourse ? activeCourse.subject : ''}
              </span>
              <span className="text-xs text-slate-455 font-medium truncate max-w-[200px]" title={activeSubjectName}>
                {activeSubjectName}
              </span>
            </div>

            {/* Page Jump Form with Prev/Next Controls */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const prev = Math.max(1, activePage - 1);
                  setActivePage(prev);
                  setPageInput(String(prev));
                  const targetEl = pageRefs.current[prev];
                  if (targetEl) {
                    targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                  setAnalysisResult(null);
                  setRecommendedQuestions([]);
                  setErrorMsg('');
                }}
                disabled={activePage <= 1}
                className="p-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 rounded-lg transition cursor-pointer border border-slate-200"
                title="Previous Page"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5"><polyline points="15 18 9 12 15 6"/></svg>
              </button>

              <form onSubmit={handleGoToPage} className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-500">Page:</span>
                <input 
                  id="pdf-page-num"
                  type="text" 
                  pattern="[0-9]*"
                  value={pageInput} 
                  onChange={(e) => setPageInput(e.target.value.replace(/\D/g,''))}
                  className="w-12 text-center bg-slate-50 border border-slate-200 rounded-lg py-1 px-1.5 focus:outline-none focus:border-indigo-500 font-semibold"
                />
                <button 
                  type="submit"
                  className="px-3 py-1 bg-slate-900 hover:bg-slate-850 text-white rounded-lg text-xs font-bold transition shadow-sm cursor-pointer"
                >
                  Go
                </button>
              </form>

              <button
                type="button"
                onClick={() => {
                  const next = Math.min(numPages, activePage + 1);
                  setActivePage(next);
                  setPageInput(String(next));
                  const targetEl = pageRefs.current[next];
                  if (targetEl) {
                    targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                  setAnalysisResult(null);
                  setRecommendedQuestions([]);
                  setErrorMsg('');
                }}
                disabled={activePage >= numPages}
                className="p-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 rounded-lg transition cursor-pointer border border-slate-200"
                title="Next Page"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5"><polyline points="9 18 15 12 9 6"/></svg>
              </button>

              <button 
                type="button"
                onClick={handleAnalyzePage}
                disabled={analyzing}
                className="ml-2 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-350 text-white rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer flex items-center gap-1.5 animate-pulse hover:animate-none"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5"><path d="M12 2v2"/><path d="M12 20v2"/><path d="M4.93 4.93l1.41 1.41"/><path d="M17.66 17.66l1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="M6.34 17.66l-1.41 1.41"/><path d="M19.07 4.93l-1.41 1.41"/></svg>
                {analyzing ? 'Understanding...' : 'Understand it deeply'}
              </button>
            </div>
          </div>

          {/* Embedded PDF Viewer (PDF.js Lazy Canvas List) */}
          {pdfLoading ? (
            <div className="flex-grow flex items-center justify-center text-center text-slate-400 bg-slate-50 border border-slate-200 rounded-xl">
              <LoadingSpinner text="Rendering PDF document pages..." />
            </div>
          ) : activeCourse && pdfDocument ? (
            <div 
              ref={scrollContainerRef}
              className="flex-grow rounded-xl overflow-y-auto border border-slate-200 bg-slate-150 p-6 relative max-h-[600px]"
            >
              <div className="space-y-6">
                {Array.from({ length: numPages }).map((_, index) => {
                  const pageNum = index + 1;
                  return (
                    <div
                      key={pageNum}
                      data-page={pageNum}
                      ref={el => pageRefs.current[pageNum] = el}
                      className="w-full max-w-[620px] mx-auto bg-white border border-slate-200 rounded-2xl p-4 shadow-sm relative flex flex-col items-center justify-start min-h-[800px]"
                    >
                      <span className="self-end text-[9px] font-bold text-slate-400 select-none pb-2">
                        Page {pageNum} of {numPages}
                      </span>
                      <PageCanvas pdfDocument={pdfDocument} pageNum={pageNum} />
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex-grow flex items-center justify-center text-center text-slate-400 bg-slate-50 border border-slate-200 rounded-xl">
              Select a course PDF to load pages.
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

// Subcomponent to render canvas page lazily using IntersectionObserver
function PageCanvas({ pdfDocument, pageNum }) {
  const [rendered, setRendered] = useState(false);
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!pdfDocument) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !rendered) {
            renderPage();
            observer.disconnect();
          }
        });
      },
      { threshold: 0.05 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [pdfDocument, rendered]);

  const renderPage = async () => {
    try {
      const page = await pdfDocument.getPage(pageNum);
      const canvas = canvasRef.current;
      if (!canvas) return;

      const context = canvas.getContext('2d');
      // Scale page to fit nicely in 560px width
      const baseViewport = page.getViewport({ scale: 1 });
      const scale = 560 / baseViewport.width;
      const viewport = page.getViewport({ scale });

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };

      await page.render(renderContext).promise;
      setRendered(true);
    } catch (err) {
      console.error(`Error rendering page ${pageNum}:`, err);
    }
  };

  return (
    <div ref={containerRef} className="w-full flex justify-center py-2 relative">
      <canvas ref={canvasRef} className="max-w-full h-auto border border-slate-150 rounded shadow bg-white" />
      {!rendered && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-50/50 rounded-xl min-h-[750px]">
          <span className="text-xs text-slate-400 font-semibold animate-pulse">Loading page {pageNum}...</span>
        </div>
      )}
    </div>
  );
}
