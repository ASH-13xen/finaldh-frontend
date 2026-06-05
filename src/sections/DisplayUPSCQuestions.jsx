import { useState, useEffect } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';

export default function DisplayUPSCQuestions() {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [activeSheetUrl, setActiveSheetUrl] = useState(null);
  const [selectedTopper, setSelectedTopper] = useState(null);

  // Fetch all UPSC questions on mount
  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const res = await fetch('/api/upsc/list');
        if (res.ok) {
          const data = await res.json();
          const list = data.questions || [];
          setQuestions(list);
          if (list.length > 0) {
            // Select first question by default
            setSelectedQuestion(list[0]);
            if (list[0].file_urls && list[0].file_urls.length > 0) {
              setActiveSheetUrl(list[0].file_urls[0].url);
              setSelectedTopper(list[0].file_urls[0]);
            }
          }
        }
      } catch (err) {
        console.error('Error fetching UPSC questions:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchQuestions();
  }, []);

  // Filter questions based on search query
  const filteredQuestions = questions.filter((q) => {
    const matchesSearch = q.question_text.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSearch;
  });

  // Handle question selection
  const handleSelectQuestion = (q) => {
    setSelectedQuestion(q);
    if (q.file_urls && q.file_urls.length > 0) {
      setActiveSheetUrl(q.file_urls[0].url);
      setSelectedTopper(q.file_urls[0]);
    } else {
      setActiveSheetUrl(null);
      setSelectedTopper(null);
    }
  };

  // Handle topper sheet selection
  const handleSelectTopper = (topper) => {
    setSelectedTopper(topper);
    setActiveSheetUrl(topper.url);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-6 py-8 h-[calc(100vh-73px)] flex flex-col">
      {/* Header Panel */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 flex-shrink-0">
        <div>
          <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight">UPSC Toppers Q&A</h1>
          <p className="text-slate-500 text-xs mt-1 font-medium">Analyze topper answers, page selections, and preview exam copies directly.</p>
        </div>
        
        {/* Search Input */}
        <div className="w-full md:w-80">
          <input
            type="text"
            placeholder="Search questions or tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-indigo-500 transition-all font-semibold shadow-sm"
          />
        </div>
      </div>

      {loading ? (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-16 text-center shadow-sm flex-grow flex items-center justify-center">
          <LoadingSpinner text="Loading UPSC questions database..." />
        </div>
      ) : questions.length === 0 ? (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-16 text-center text-slate-400 shadow-sm flex-grow flex flex-col items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-12 h-12 mb-4 text-slate-300"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
          <p className="text-sm font-semibold text-slate-650">UPSC database is empty</p>
          <p className="text-xs text-slate-400 mt-1 max-w-sm">No UPSCQA documents found. Make sure the migration completed successfully and populated the database.</p>
        </div>
      ) : (
        <div className="flex-grow flex flex-col lg:flex-row gap-6 min-h-0 overflow-hidden pb-4">
          
          {/* Left Column: Scrollable Questions List (1/3 Width) */}
          <div className="lg:w-1/3 flex flex-col min-h-0 bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm">
            <div className="bg-slate-50/50 border-b border-slate-100 px-4 py-3 flex items-center justify-between flex-shrink-0">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Questions Feed</span>
              <span className="text-[10px] bg-slate-200 text-slate-600 font-bold px-2 py-0.5 rounded-full">{filteredQuestions.length} matches</span>
            </div>
            
            <div className="flex-grow overflow-y-auto p-4 space-y-3">
              {filteredQuestions.map((q) => {
                const isSelected = selectedQuestion?._id === q._id;
                return (
                  <div
                    key={q._id}
                    onClick={() => handleSelectQuestion(q)}
                    className={`p-4 border rounded-xl cursor-pointer transition-all duration-200 hover:border-slate-350 hover:shadow-sm ${isSelected ? 'border-indigo-650 bg-indigo-50/20 ring-1 ring-indigo-500/20' : 'border-slate-200/80 bg-white'}`}
                  >
                    {/* Tags */}
                    <div className="flex flex-wrap gap-1 mb-2.5">
                      {q.tags.slice(0, 3).map((tag, i) => (
                        <span key={i} className="text-[8px] font-bold text-slate-550 bg-slate-100 px-1.5 py-0.5 rounded tracking-wide uppercase">
                          {tag}
                        </span>
                      ))}
                      {q.tags.length > 3 && (
                        <span className="text-[8px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                          +{q.tags.length - 3}
                        </span>
                      )}
                    </div>
                    
                    {/* Question text snippet */}
                    <p className="text-xs text-slate-700 font-semibold line-clamp-3 leading-relaxed">
                      {q.question_text}
                    </p>
                    
                    {/* Bottom Metadata */}
                    <div className="flex items-center justify-between mt-3 text-[9px] text-slate-400 font-semibold">
                      <span>Pages {q.start_page}-{q.end_page}</span>
                      <span className="flex items-center gap-1 text-indigo-650 font-bold">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3 h-3"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        {q.file_urls?.length || 0} sheets
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Split Workspace containing Topper copy and PDF Previewer (2/3 Width) */}
          <div className="lg:w-2/3 flex flex-col lg:flex-row gap-6 min-h-0">
            
            {/* Question Details & Toppers list pane (Left inside split) */}
            <div className="lg:w-1/2 flex flex-col min-h-0 bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm">
              <div className="bg-slate-50/50 border-b border-slate-100 px-4 py-3 flex items-center justify-between flex-shrink-0">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Question Inspector</span>
              </div>
              
              <div className="flex-grow overflow-y-auto p-5 space-y-5">
                {selectedQuestion ? (
                  <>
                    {/* Full Question Text */}
                    <div className="space-y-2">
                      <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Question Text</h3>
                      <div className="p-4 bg-slate-50 border border-slate-150 rounded-xl text-xs md:text-sm text-slate-800 leading-relaxed font-medium">
                        {selectedQuestion.question_text}
                      </div>
                    </div>

                    {/* Metadata Detail Row */}
                    <div className="grid grid-cols-2 gap-4 border-b border-slate-100 pb-4">
                      <div>
                        <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Page Coverage</h4>
                        <p className="text-xs font-bold text-slate-700 mt-1">Start Page {selectedQuestion.start_page} — End Page {selectedQuestion.end_page}</p>
                      </div>
                      <div>
                        <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Collection Tags</h4>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {selectedQuestion.tags.map((tag, i) => (
                            <span key={i} className="text-[8px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded uppercase">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Topper Sheets List */}
                    <div className="space-y-3">
                      <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Available Toppers Answers ({selectedQuestion.file_urls?.length || 0})</h3>
                      {selectedQuestion.file_urls && selectedQuestion.file_urls.length > 0 ? (
                        <div className="space-y-2">
                          {selectedQuestion.file_urls.map((topper, i) => {
                            const isSelectedTopper = selectedTopper?.url === topper.url;
                            return (
                              <div
                                key={i}
                                onClick={() => handleSelectTopper(topper)}
                                className={`p-4 border rounded-xl cursor-pointer transition-all hover:border-slate-350 hover:bg-slate-50/50 flex flex-col justify-between gap-3 ${isSelectedTopper ? 'border-indigo-650 bg-indigo-50/10' : 'border-slate-150'}`}
                              >
                                <div className="flex items-start justify-between">
                                  <div>
                                    <h4 className="text-xs font-extrabold text-slate-800">{topper.topper_name || 'Anonymous Topper'}</h4>
                                    <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Year: {topper.topper_year || 'N/A'} | Rank: {topper.topper_rank || 'N/A'}</p>
                                  </div>
                                  <div className="bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded">
                                    {topper.topper_marks ? `${topper.topper_marks} Marks` : 'N/A'}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSelectTopper(topper);
                                  }}
                                  className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>
                                  Preview Answer Copy
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic">No topper copies linked to this question.</p>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400 italic text-xs">
                    Select a question from the left feed to inspect details.
                  </div>
                )}
              </div>
            </div>

            {/* PDF Previewer Pane (Right inside split) */}
            <div className="lg:w-1/2 flex flex-col min-h-0 bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm">
              <div className="bg-slate-50/50 border-b border-slate-100 px-4 py-3 flex items-center justify-between flex-shrink-0">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Answer Sheet Preview</span>
                {selectedTopper && (
                  <span className="text-[10px] font-bold text-indigo-650 bg-indigo-50 border border-indigo-100 rounded px-2 py-0.5 max-w-[120px] truncate">
                    {selectedTopper.topper_name}
                  </span>
                )}
              </div>
              
              <div className="flex-grow bg-slate-100 relative min-h-[300px]">
                {activeSheetUrl ? (
                  <iframe
                    key={activeSheetUrl}
                    src={`/api/upsc/proxy-pdf?url=${encodeURIComponent(activeSheetUrl)}#toolbar=0&navpanes=0`}
                    title="Topper Copy Previewer"
                    className="w-full h-full border-0 absolute inset-0"
                    allow="autoplay"
                  />
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center space-y-3">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-10 h-10 text-slate-300"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="M10 13h4"/><path d="M10 17h4"/></svg>
                    <p className="text-xs font-bold text-slate-500">No topper copy selected</p>
                    <p className="text-[10px] text-slate-400 max-w-[180px]">Choose a question and click "Preview Answer Copy" to inspect the topper's handwritten sheet.</p>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
