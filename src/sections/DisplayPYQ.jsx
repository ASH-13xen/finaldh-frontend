import { useState, useEffect } from 'react';
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

export default function DisplayPYQ() {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubject, setSelectedSubject] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch all questions from global database
  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const res = await fetch('/api/questions/list');
        if (res.ok) {
          const data = await res.json();
          setQuestions(data.questions || []);
        }
      } catch (err) {
        console.error('Error fetching questions:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchQuestions();
  }, []);

  // Filter questions based on selected subject and search query
  const filteredQuestions = questions.filter((q) => {
    const matchesSubject = selectedSubject === 'ALL' || q.subject === selectedSubject;
    const matchesSearch = q.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (q.tags?.section || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (q.tags?.title || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSubject && matchesSearch;
  });

  return (
    <div className="w-full max-w-5xl mx-auto px-6 py-10 md:py-14">
      {/* Header Info */}
      <div className="mb-10 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">Display PYQs</h1>
          <p className="text-slate-500 text-sm mt-1.5 font-medium">Browse and search through all extracted Previous Years Questions (PYQs).</p>
        </div>
        <div className="text-slate-400 text-xs font-semibold bg-white border border-slate-200/80 rounded-xl px-4 py-2 shadow-sm flex items-center gap-1.5 w-fit">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>{filteredQuestions.length} matching questions</span>
        </div>
      </div>

      {/* Filter and Search Panel */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm mb-8 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Subject Filter Dropdown */}
          <div className="md:col-span-2">
            <label htmlFor="filter-subject" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Filter by Subject</label>
            <select
              id="filter-subject"
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-indigo-500 transition-all font-semibold"
            >
              <option value="ALL">All Subjects</option>
              <optgroup label="General Studies Modules">
                {Object.entries(SUBJECT_NAMES).map(([id, name]) => (
                  <option key={id} value={id}>{name}</option>
                ))}
              </optgroup>
              <optgroup label="Optional Subjects">
                {Object.entries(OPTIONAL_NAMES).map(([id, name]) => (
                  <option key={id} value={id}>{name}</option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Text Search Input */}
          <div>
            <label htmlFor="search-questions" className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Search Questions</label>
            <input
              id="search-questions"
              type="text"
              placeholder="Search keyword, tag..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-indigo-500 transition-all font-semibold"
            />
          </div>
        </div>
      </div>

      {/* Main Listing View */}
      {loading ? (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-16 text-center shadow-sm">
          <LoadingSpinner text="Retrieving all PYQs..." />
        </div>
      ) : filteredQuestions.length === 0 ? (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-16 text-center text-slate-400 shadow-sm">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-12 h-12 mx-auto mb-4 text-slate-300"><circle cx="12" cy="12" r="10"/><path d="m21 21-4.3-4.3"/></svg>
          <p className="text-sm font-semibold text-slate-650">No questions found matching your filter</p>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">Try selecting another subject or clearing your search keywords to view the question list.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredQuestions.map((q) => {
            const isGS = q.subject.startsWith('GS-');
            const displayName = isGS ? q.subject : OPTIONAL_NAMES[q.subject]?.replace('Optional: ', '') || q.subject;
            return (
              <div key={q._id} className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4 hover:border-slate-300 hover:shadow-md transition-all duration-300 flex flex-col justify-between">
                <div className="space-y-3">
                  {/* Card Badges */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[9px] font-bold text-indigo-650 bg-indigo-50 border border-indigo-100 rounded px-1.5 py-0.5 uppercase tracking-wide">
                      {displayName}
                    </span>
                    <span className="text-[9px] font-bold text-slate-500 bg-slate-50 border border-slate-150 rounded px-1.5 py-0.5 uppercase tracking-wide">
                      Year {q.year}
                    </span>
                  </div>

                  {/* Question Text */}
                  <p className="text-xs md:text-sm text-slate-800 leading-relaxed font-medium whitespace-pre-wrap">
                    {q.text}
                  </p>
                </div>

                {/* Footer Syllabus Tags */}
                <div className="border-t border-slate-100 pt-3.5 mt-3 flex flex-wrap gap-2 text-[10px] font-semibold text-slate-400">
                  <div className="flex items-center gap-1 bg-slate-50 border border-slate-100 rounded px-2 py-0.5 max-w-[200px] truncate">
                    <span className="text-[8px] text-slate-350">SEC</span>
                    <span className="text-slate-600 truncate">{q.tags?.section || 'General'}</span>
                  </div>
                  <div className="flex items-center gap-1 bg-slate-50 border border-slate-100 rounded px-2 py-0.5 max-w-[200px] truncate">
                    <span className="text-[8px] text-slate-350">TOPIC</span>
                    <span className="text-slate-600 truncate">{q.tags?.title || 'General'}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
