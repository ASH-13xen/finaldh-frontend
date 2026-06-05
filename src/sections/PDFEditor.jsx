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

export default function PDFEditor() {
  // Initialization States
  const [purchasedCourses, setPurchasedCourses] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [initializingSession, setInitializingSession] = useState(false);
  const [customFile, setCustomFile] = useState(null);

  // Active Session States
  const [editId, setEditId] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [fileName, setFileName] = useState('');
  
  // PDF Rendering States
  const [pdfDocument, setPdfDocument] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [activePage, setActivePage] = useState(1);
  const [pageInput, setPageInput] = useState('1');
  const [pdfLoading, setPdfLoading] = useState(false);
  const [renderTrigger, setRenderTrigger] = useState(0); // Force canvas re-render on edit

  // Mouse Selection States
  const [drawing, setDrawing] = useState(false);
  const [box, setBox] = useState(null); // { x, y, width, height } relative to overlay
  const overlayRef = useRef(null);
  const canvasRef = useRef(null);

  // Gemini & Action States
  const [detecting, setDetecting] = useState(false);
  const [applying, setApplying] = useState(false);
  const [autoCleaning, setAutoCleaning] = useState(false);
  const [autoCleanPhase, setAutoCleanPhase] = useState('none'); // 'none', 'preview', 'preview_ready', 'remaining', 'completed'
  const [aiResult, setAiResult] = useState(null);
  const [cleanedQuestionText, setCleanedQuestionText] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [selectivePagesInput, setSelectivePagesInput] = useState('');
  const [selectiveCleaning, setSelectiveCleaning] = useState(false);

  // Fetch purchased courses for selection
  useEffect(() => {
    const fetchPurchased = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoadingCourses(false);
        return;
      }
      try {
        const res = await fetch('/api/courses/purchased', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setPurchasedCourses(data.purchasedCourses || []);
        }
      } catch (err) {
        console.error('Error fetching purchased courses:', err);
      } finally {
        setLoadingCourses(false);
      }
    };
    fetchPurchased();
  }, []);

  // Load PDF.js library dynamically from CDN
  useEffect(() => {
    if (window.pdfjsLib) return;
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js';
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
    };
    document.head.appendChild(script);
  }, []);

  // Load PDF document on pdfUrl change
  useEffect(() => {
    if (!pdfUrl) {
      setPdfDocument(null);
      setNumPages(0);
      return;
    }
    loadPDFDoc(pdfUrl);
  }, [pdfUrl]);

  const loadPDFDoc = async (url) => {
    setPdfLoading(true);
    setPdfDocument(null);
    setNumPages(0);
    setErrorMsg('');
    try {
      const baseUrl = import.meta.env.VITE_API_URL || '';
      const absoluteUrl = (url.startsWith('/uploads/') || url.startsWith('uploads/')) && baseUrl
        ? `${baseUrl.replace(/\/$/, '')}${url.startsWith('/') ? url : `/${url}`}`
        : url;
      const loadingTask = window.pdfjsLib.getDocument(absoluteUrl);
      const pdf = await loadingTask.promise;
      setPdfDocument(pdf);
      setNumPages(pdf.numPages);
    } catch (err) {
      console.error('Error loading PDF document:', err);
      setErrorMsg('Failed to load PDF file preview. Please try again.');
    } finally {
      setPdfLoading(false);
    }
  };

  // Render canvas page
  useEffect(() => {
    if (!pdfDocument) return;
    renderPage(activePage);
  }, [pdfDocument, activePage, renderTrigger]);

  const renderPage = async (pageNum) => {
    try {
      const page = await pdfDocument.getPage(pageNum);
      const canvas = canvasRef.current;
      if (!canvas) return;

      const context = canvas.getContext('2d');
      const baseViewport = page.getViewport({ scale: 1 });
      const scale = 600 / baseViewport.width;
      const viewport = page.getViewport({ scale });

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };

      await page.render(renderContext).promise;
      
      setBox(null);
      setAiResult(null);
      setCleanedQuestionText('');
    } catch (err) {
      console.error(`Error rendering page ${pageNum}:`, err);
    }
  };

  // Initialize course edit
  const handleSelectCourse = async (courseId) => {
    if (!courseId) return;
    setInitializingSession(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch('/api/pdf-editor/init', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ courseId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to initialize edit session');

      setEditId(data.editId);
      setPdfUrl(data.url);
      setFileName(data.fileName);
      setActivePage(1);
      setPageInput('1');
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message);
    } finally {
      setInitializingSession(false);
    }
  };

  // Initialize custom PDF upload
  const handleUploadFile = async (e) => {
    e.preventDefault();
    if (!customFile) return;

    setInitializingSession(true);
    setErrorMsg('');
    setSuccessMsg('');

    const formData = new FormData();
    formData.append('file', customFile);

    try {
      const res = await fetch('/api/pdf-editor/init', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to upload PDF file');

      setEditId(data.editId);
      setPdfUrl(data.url);
      setFileName(data.fileName);
      setActivePage(1);
      setPageInput('1');
      setCustomFile(null);
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message);
    } finally {
      setInitializingSession(false);
    }
  };

  // Draw overlay mouse handlers
  const handleMouseDown = (e) => {
    if (!overlayRef.current || pdfLoading || applying || detecting) return;
    const rect = overlayRef.current.getBoundingClientRect();
    const startX = e.clientX - rect.left;
    const startY = e.clientY - rect.top;
    setDrawing(true);
    setBox({ x: startX, y: startY, width: 0, height: 0 });
    setSuccessMsg('');
    setErrorMsg('');
  };

  const handleMouseMove = (e) => {
    if (!drawing || !overlayRef.current) return;
    const rect = overlayRef.current.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;
    setBox(prev => ({
      ...prev,
      width: currentX - prev.x,
      height: currentY - prev.y
    }));
  };

  const handleMouseUp = () => {
    setDrawing(false);
  };

  const getNormalizedBox = () => {
    if (!box) return null;
    return {
      x: box.width < 0 ? box.x + box.width : box.x,
      y: box.height < 0 ? box.y + box.height : box.y,
      width: Math.abs(box.width),
      height: Math.abs(box.height)
    };
  };

  // Call Gemini OCR prefix detection
  const handleAutoDetect = async () => {
    if (!canvasRef.current || detecting || applying) return;
    setDetecting(true);
    setAiResult(null);
    setErrorMsg('');
    setSuccessMsg('');
    setBox(null);
    setCleanedQuestionText('');

    try {
      const canvas = canvasRef.current;
      const imageBase64 = canvas.toDataURL('image/jpeg', 0.95);

      const res = await fetch('/api/pdf-editor/detect-prefix', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ image: imageBase64 })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to detect prefix with AI');

      const { originalText, cleanedText, prefixText, boundingBox } = data.result;

      if (!boundingBox || boundingBox.ymin === null) {
        setAiResult({ found: false });
        setErrorMsg('AI could not locate a question prefix on this page. Try drawing a selection box manually.');
        return;
      }

      setAiResult({ 
        found: true, 
        original: originalText,
        cleaned: cleanedText,
        prefix: prefixText 
      });
      setCleanedQuestionText(cleanedText);

      // Convert Gemini coordinates (0 to 1000) to actual canvas dimensions
      const overlayWidth = canvas.clientWidth;
      const overlayHeight = canvas.clientHeight;

      const scaleBox = {
        x: (boundingBox.xmin / 1000) * overlayWidth,
        y: (boundingBox.ymin / 1000) * overlayHeight,
        width: ((boundingBox.xmax - boundingBox.xmin) / 1000) * overlayWidth,
        height: ((boundingBox.ymax - boundingBox.ymin) / 1000) * overlayHeight
      };

      setBox(scaleBox);
      setSuccessMsg(`AI successfully detected and cleaned question prefix!`);
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Error occurred during AI prefix detection.');
    } finally {
      setDetecting(false);
    }
  };

  // Call apply-whiteout to strip old text and draw new centered text
  const handleApplyReplacement = async () => {
    const normBox = getNormalizedBox();
    if (!normBox || normBox.width < 5 || normBox.height < 5) {
      setErrorMsg('Please select the question region on the page first.');
      return;
    }
    if (!cleanedQuestionText.trim()) {
      setErrorMsg('Please enter or review the cleaned question text to write.');
      return;
    }

    setApplying(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const canvas = canvasRef.current;
      const viewport = {
        width: canvas.clientWidth,
        height: canvas.clientHeight
      };

      const res = await fetch('/api/pdf-editor/apply-whiteout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          editId,
          pageNumber: activePage,
          box: normBox,
          viewport,
          cleanedText: cleanedQuestionText
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to replace text in PDF');

      setPdfUrl(data.url);
      setRenderTrigger(prev => prev + 1);
      setSuccessMsg('Question prefix removed and cleaned text written center-aligned!');
      setBox(null);
      setAiResult(null);
      setCleanedQuestionText('');
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Error applying changes to PDF file.');
    } finally {
      setApplying(false);
    }
  };

  const handleAutoCleanPreview = async () => {
    if (autoCleaning || pdfLoading || applying || detecting) return;
    setAutoCleaning(true);
    setAutoCleanPhase('preview');
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch('/api/pdf-editor/auto-clean', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ editId, startPage: 1, maxPages: 10 })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to auto-clean preview pages');

      setPdfUrl(data.url);
      setRenderTrigger(prev => prev + 1);
      setSuccessMsg('First 10 pages have been cleaned successfully! Please verify them in the preview window.');
      setAutoCleanPhase('preview_ready');
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Error occurred during automated PDF cleaning.');
      setAutoCleanPhase('none');
    } finally {
      setAutoCleaning(false);
    }
  };

  const handleAutoCleanRemaining = async () => {
    if (autoCleaning || pdfLoading || applying || detecting) return;
    setAutoCleaning(true);
    setAutoCleanPhase('remaining');
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await fetch('/api/pdf-editor/auto-clean', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ editId, startPage: 11 })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to auto-clean remaining pages');

      setPdfUrl(data.url);
      setRenderTrigger(prev => prev + 1);
      setSuccessMsg('Entire PDF automatically cleaned and questions replaced successfully!');
      setAutoCleanPhase('completed');
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Error occurred during automated PDF cleaning.');
      setAutoCleanPhase('preview_ready');
    } finally {
      setAutoCleaning(false);
    }
  };

  const parseExplicitPages = (inputString, maxPages) => {
    const pages = new Set();
    const parts = inputString.split(',');
    for (const part of parts) {
      const page = parseInt(part.trim(), 10);
      if (!isNaN(page) && page >= 1 && (!maxPages || page <= maxPages)) {
        pages.add(page);
      }
    }
    return Array.from(pages).sort((a, b) => a - b);
  };

  const handleSelectiveClean = async () => {
    if (selectiveCleaning || autoCleaning || pdfLoading || applying || detecting) return;
    
    setErrorMsg('');
    setSuccessMsg('');

    const parsedPages = parseExplicitPages(selectivePagesInput, numPages);
    if (parsedPages.length === 0) {
      setErrorMsg(`Please enter valid explicit page numbers within the range 1 to ${numPages}.`);
      return;
    }

    setSelectiveCleaning(true);
    try {
      const res = await fetch('/api/pdf-editor/clean-pages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ editId, pages: parsedPages })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to clean selected pages');

      setPdfUrl(data.url);
      setRenderTrigger(prev => prev + 1);
      setSuccessMsg(data.message || 'Selected pages cleaned successfully!');
      setSelectivePagesInput('');
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Error occurred during selective page cleaning.');
    } finally {
      setSelectiveCleaning(false);
    }
  };

  const handleGoToPage = (e) => {
    e.preventDefault();
    const num = parseInt(pageInput, 10);
    if (!isNaN(num) && num > 0 && num <= numPages) {
      setActivePage(num);
    } else {
      setErrorMsg(`Invalid page number. Please enter a page between 1 and ${numPages}.`);
    }
  };

  const handleResetSession = () => {
    setEditId(null);
    setPdfUrl(null);
    setFileName('');
    setPdfDocument(null);
    setNumPages(0);
    setActivePage(1);
    setPageInput('1');
    setBox(null);
    setAiResult(null);
    setCleanedQuestionText('');
    setErrorMsg('');
    setSuccessMsg('');
    setAutoCleanPhase('none');
    setSelectivePagesInput('');
  };

  if (!editId) {
    return (
      <div className="w-full max-w-4xl mx-auto px-6 py-12 md:py-16 flex flex-col gap-8 animate-fadeIn">
        <div className="border-b border-slate-200 pb-5">
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-6 h-6 text-indigo-600"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            AI PDF Editor
          </h1>
          <p className="text-slate-500 text-sm mt-1.5 font-medium">Load purchased courses or upload custom PDF sheets to strip out question prefixes and center-align cleaned question text without altering backgrounds.</p>
        </div>

        {errorMsg && (
          <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-xs font-semibold flex items-start gap-2.5">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4 text-rose-500 mt-0.5 flex-shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span>{errorMsg}</span>
          </div>
        )}

        {initializingSession ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center shadow-sm">
            <LoadingSpinner text="Copying PDF file and preparing workspace..." />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Option A */}
            <div className="bg-white border border-slate-200/80 hover:border-indigo-400 rounded-2xl p-8 shadow-sm flex flex-col justify-between transition duration-300">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-650">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Edit Purchased Course E-Book</h3>
                  <p className="text-xs text-slate-450 mt-1 leading-relaxed">Choose one of your purchased textbook packages to open and clean question prefixes.</p>
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-slate-50">
                {loadingCourses ? (
                  <div className="py-2 text-center text-xs text-slate-400 font-medium">Fetching courses...</div>
                ) : purchasedCourses.length === 0 ? (
                  <div className="py-2 text-xs text-slate-400 italic font-semibold">No purchased courses available.</div>
                ) : (
                  <div className="space-y-3">
                    <label htmlFor="course-select-editor" className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Select PDF</label>
                    <select
                      id="course-select-editor"
                      onChange={(e) => handleSelectCourse(e.target.value)}
                      defaultValue=""
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer"
                    >
                      <option value="" disabled>Choose a course e-book...</option>
                      {purchasedCourses.map((c) => (
                        <option key={c._id} value={c._id}>{c.name || c.fileName}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Option B */}
            <div className="bg-white border border-slate-200/80 hover:border-indigo-400 rounded-2xl p-8 shadow-sm flex flex-col justify-between transition duration-300">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-650">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Upload Custom PDF Document</h3>
                  <p className="text-xs text-slate-450 mt-1 leading-relaxed">Directly upload any handwritten topper answers copy or PDF document (up to 2 GB) from your device to clean.</p>
                </div>
              </div>

              <form onSubmit={handleUploadFile} className="mt-8 pt-4 border-t border-slate-50 space-y-4">
                <div>
                  <label htmlFor="custom-pdf-upload" className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Upload File</label>
                  <input
                    id="custom-pdf-upload"
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setCustomFile(e.target.files[0])}
                    className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!customFile}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-300 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
                >
                  Start Editing
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  const normBox = getNormalizedBox();

  return (
    <div className="w-full max-w-7xl mx-auto px-6 py-8 flex flex-col gap-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="space-y-1">
          <span className="text-[9px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 rounded px-2 py-0.5 uppercase tracking-wide">
            PDF Editor Active
          </span>
          <h1 className="text-lg md:text-xl font-bold text-slate-900 tracking-tight truncate max-w-[400px]" title={fileName}>
            Editing: {fileName}
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleResetSession}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-200 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            Close Session
          </button>
          
          <a
            href={`${import.meta.env.VITE_API_URL || ''}/api/pdf-editor/download/${editId}`}
            download
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-650 hover:bg-indigo-600 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Download Cleaned PDF
          </a>
        </div>
      </div>

      {/* Messaging */}
      {errorMsg && (
        <div className="p-3.5 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-xs font-semibold flex items-start gap-2.5">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4 text-rose-500 mt-0.5 flex-shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-700 text-xs font-semibold flex items-start gap-2.5">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0"><circle cx="12" cy="12" r="10"/><polyline points="12 8 8 12 12 16"/><line x1="16" y1="12" x2="8" y2="12"/></svg>
          <span>{successMsg}</span>
        </div>
      )}

      {/* Split Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        
        {/* Left Column (PDF viewport) */}
        <div className="lg:col-span-8 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col gap-4 min-h-[600px]">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <span className="text-xs font-bold text-slate-450 uppercase">Page Viewport</span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const prev = Math.max(1, activePage - 1);
                  setActivePage(prev);
                  setPageInput(String(prev));
                }}
                disabled={activePage <= 1 || pdfLoading || applying || detecting}
                className="p-1.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 disabled:opacity-50 text-slate-700 rounded-lg transition cursor-pointer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5"><polyline points="15 18 9 12 15 6"/></svg>
              </button>

              <form onSubmit={handleGoToPage} className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-500">Page:</span>
                <input
                  type="text"
                  pattern="[0-9]*"
                  value={pageInput}
                  onChange={(e) => setPageInput(e.target.value.replace(/\D/g,''))}
                  disabled={pdfLoading || applying || detecting}
                  className="w-12 text-center bg-slate-50 border border-slate-200 rounded-lg py-1 px-1 focus:outline-none focus:border-indigo-500 text-xs font-bold"
                />
                <span className="text-xs text-slate-400 font-semibold">of {numPages}</span>
                <button
                  type="submit"
                  disabled={pdfLoading || applying || detecting}
                  className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white rounded-lg text-xs font-bold transition cursor-pointer"
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
                }}
                disabled={activePage >= numPages || pdfLoading || applying || detecting}
                className="p-1.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 disabled:opacity-50 text-slate-700 rounded-lg transition cursor-pointer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>
          </div>

          <div className="flex-grow flex justify-center bg-slate-100 rounded-xl p-4 overflow-y-auto border border-slate-200/60 max-h-[620px] min-h-[500px] relative">
            {pdfLoading ? (
              <div className="flex items-center justify-center w-full">
                <LoadingSpinner text="Rendering PDF document page..." />
              </div>
            ) : (
              <div 
                className="relative inline-block select-none"
                style={{ height: canvasRef.current?.height ? `${canvasRef.current.height}px` : 'auto' }}
              >
                <canvas 
                  ref={canvasRef} 
                  className="border border-slate-300 rounded shadow bg-white max-w-full" 
                />

                {/* Mouse interaction overlay */}
                <div
                  ref={overlayRef}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  className="absolute inset-0 cursor-crosshair z-25 bg-transparent"
                />

                {/* Drawing Box */}
                {box && (
                  <div
                    style={{
                      position: 'absolute',
                      border: '2px dashed #4f46e5',
                      backgroundColor: 'rgba(79, 70, 229, 0.08)',
                      left: `${normBox.x}px`,
                      top: `${normBox.y}px`,
                      width: `${normBox.width}px`,
                      height: `${normBox.height}px`,
                      pointerEvents: 'none',
                      zIndex: 30
                    }}
                  >
                    <div className="absolute -top-2.5 -left-1 bg-indigo-600 text-white font-bold text-[8px] px-1 rounded shadow select-none">
                      Question Target Area
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (Controls) */}
        <div className="lg:col-span-4 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col justify-between min-h-[680px]">
          
          <div className="space-y-5">
            <div>
              <h2 className="text-sm font-extrabold text-slate-900 tracking-tight flex items-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4 text-indigo-650"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                Editor Panel
              </h2>
              <p className="text-[10px] text-slate-450 font-semibold mt-0.5">Strip prefixes and write cleaned, centered question text.</p>
            </div>

            {/* Instruction list */}
            <div className="bg-slate-50 border border-slate-150 rounded-xl p-3.5 text-[11px] text-slate-550 font-semibold space-y-2 leading-relaxed">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">How to Clean</h3>
              <ol className="list-decimal pl-4 space-y-1.5">
                <li>Navigate to your page containing the prefixed question.</li>
                <li>Draw a target area around the question by dragging on the canvas.</li>
                <li>Or, click <span className="text-indigo-650 font-bold">Auto-Detect</span> below to let Gemini identify the text.</li>
                <li>Review/edit the text in the textarea below.</li>
                <li>Click <span className="text-slate-800 font-bold">Strip & Replace Text</span> to cleanly replace it center-aligned!</li>
              </ol>
            </div>

            {/* Auto-Clean Entire PDF Card */}
            <div className="bg-gradient-to-br from-indigo-50/65 to-violet-50/65 border border-indigo-100 rounded-xl p-4 space-y-3">
              <div>
                <h3 className="text-xs font-bold text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5 text-indigo-650"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m12 8-4 4h8z"/><path d="M12 12v6"/></svg>
                  Bulk AI Clean
                </h3>
                <p className="text-[10px] text-indigo-700/90 font-medium mt-0.5 leading-relaxed">
                  {autoCleanPhase === 'none' && "Step 1: Clean and verify the first 10 pages before processing the rest."}
                  {autoCleanPhase === 'preview' && "Cleaning pages 1 to 10. Please wait..."}
                  {autoCleanPhase === 'preview_ready' && "Preview ready! Check the first 10 pages. If they look correct, click proceed to clean the remaining pages."}
                  {autoCleanPhase === 'remaining' && "Cleaning the remaining pages in chunks of 50. Please wait..."}
                  {autoCleanPhase === 'completed' && "All pages successfully auto-cleaned!"}
                </p>
              </div>

              {autoCleanPhase === 'none' && (
                <button
                  type="button"
                  onClick={handleAutoCleanPreview}
                  disabled={autoCleaning || pdfLoading || applying || detecting}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-300 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>
                  Run AI Auto-Clean (Pages 1-10)
                </button>
              )}

              {autoCleanPhase === 'preview' && (
                <button
                  type="button"
                  disabled
                  className="w-full py-2.5 bg-indigo-400 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-not-allowed shadow-sm"
                >
                  <svg className="animate-spin h-3.5 w-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Cleaning Pages 1-10...
                </button>
              )}

              {autoCleanPhase === 'preview_ready' && (
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={handleAutoCleanRemaining}
                    disabled={autoCleaning || pdfLoading || applying || detecting}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-300 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5"><polyline points="20 6 9 17 4 12"/></svg>
                    Proceed with Entire PDF
                  </button>
                  <button
                    type="button"
                    onClick={handleAutoCleanPreview}
                    disabled={autoCleaning || pdfLoading || applying || detecting}
                    className="w-full py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                  >
                    Reclean Preview (Pages 1-10)
                  </button>
                </div>
              )}

              {autoCleanPhase === 'remaining' && (
                <button
                  type="button"
                  disabled
                  className="w-full py-2.5 bg-indigo-400 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-not-allowed shadow-sm"
                >
                  <svg className="animate-spin h-3.5 w-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Cleaning Remaining Pages...
                </button>
              )}

              {autoCleanPhase === 'completed' && (
                <button
                  type="button"
                  onClick={() => setAutoCleanPhase('none')}
                  className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-100 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                  Clean Again
                </button>
              )}
            </div>

            {/* Selective Page AI Clean Card */}
            <div className="bg-gradient-to-br from-indigo-50/65 to-violet-50/65 border border-indigo-100 rounded-xl p-4 space-y-3">
              <div>
                <h3 className="text-xs font-bold text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5 text-indigo-650"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
                  Selective Page AI Clean
                </h3>
                <p className="text-[10px] text-indigo-700/90 font-medium mt-0.5 leading-relaxed">
                  Clean explicit page numbers in chunks of 10 pages.
                </p>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="selective-pages-input" className="block text-[9px] font-bold text-indigo-950/70 uppercase tracking-wide">Enter page numbers (comma separated)</label>
                <input
                  id="selective-pages-input"
                  type="text"
                  value={selectivePagesInput}
                  onChange={(e) => setSelectivePagesInput(e.target.value)}
                  placeholder="e.g. 1, 3, 5, 8"
                  disabled={selectiveCleaning || autoCleaning || pdfLoading || applying || detecting}
                  className="w-full px-3 py-2 bg-white/95 border border-indigo-200 rounded-lg text-xs font-semibold focus:outline-none focus:border-indigo-500 shadow-inner"
                />
              </div>

              <button
                type="button"
                onClick={handleSelectiveClean}
                disabled={!selectivePagesInput.trim() || selectiveCleaning || autoCleaning || pdfLoading || applying || detecting}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-300 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                {selectiveCleaning ? (
                  <>
                    <svg className="animate-spin h-3.5 w-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    Cleaning Pages...
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
                    Clean Selected Pages
                  </>
                )}
              </button>
            </div>

            {/* Cleaned Text Area */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cleaned Question Text (Editable)</label>
              <textarea
                value={cleanedQuestionText}
                onChange={(e) => setCleanedQuestionText(e.target.value)}
                placeholder="Wait for AI detection or type the cleaned question text here..."
                disabled={pdfLoading || applying}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-semibold focus:outline-none focus:border-indigo-500 h-28 resize-none shadow-inner"
              />
            </div>

            {/* AI Results */}
            {aiResult && (
              <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl text-xs space-y-1">
                <span className="text-[9px] font-bold text-indigo-700 uppercase tracking-wider bg-white border border-indigo-100 rounded px-1.5 py-0.2">AI Detected Prefix</span>
                {aiResult.found ? (
                  <p className="font-semibold text-slate-700 leading-normal mt-1">
                    Prefix found: <span className="font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 rounded px-1.5 py-0.5">{aiResult.prefix || 'N/A'}</span>
                  </p>
                ) : (
                  <p className="font-semibold text-slate-500 italic mt-1">No prefix detected. Please select manually.</p>
                )}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="space-y-3 pt-4 border-t border-slate-100">
            {/* Auto Detect */}
            <button
              type="button"
              onClick={handleAutoDetect}
              disabled={detecting || applying || pdfLoading}
              className="w-full py-2.5 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50 text-indigo-700 border border-indigo-100 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              {detecting ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-indigo-650" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Detecting with AI...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                  Auto-Detect Question with AI
                </>
              )}
            </button>

            {/* Replace Button */}
            <button
              type="button"
              onClick={handleApplyReplacement}
              disabled={!box || !cleanedQuestionText.trim() || applying || detecting || pdfLoading}
              className="w-full py-3 bg-indigo-650 hover:bg-indigo-600 disabled:bg-indigo-300 text-white rounded-xl text-xs font-bold transition shadow flex items-center justify-center gap-2 cursor-pointer"
            >
              {applying ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Replacing Text...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  Strip & Replace Text
                </>
              )}
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
