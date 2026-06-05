import { useState } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';

const OPTIONAL_NAMES = {
  OptionalSubjectAgriculture: 'Agriculture',
  OptionalSubjectAnimalHusbandryAndVeterinaryScience: 'Animal Husbandry & Veterinary Science',
  OptionalSubjectAnthropology: 'Anthropology',
  OptionalSubjectBotany: 'Botany',
  OptionalSubjectChemistry: 'Chemistry',
  OptionalSubjectCivilEngineering: 'Civil Engineering',
  OptionalSubjectCommerceAndAccountancy: 'Commerce & Accountancy',
  OptionalSubjectEconomics: 'Economics',
  OptionalSubjectElectricalEngineering: 'Electrical Engineering',
  OptionalSubjectGeography: 'Geography',
  OptionalSubjectGeology: 'Geology',
  OptionalSubjectHistory: 'History',
  OptionalSubjectLaw: 'Law',
  OptionalSubjectMangement: 'Management',
  OptionalSubjectMathematics: 'Mathematics',
  OptionalSubjectMechanicalEngineering: 'Mechanical Engineering',
  OptionalSubjectMedicalScience: 'Medical Science',
  OptionalSubjectPhilosophy: 'Philosophy',
  OptionalSubjectPhysics: 'Physics',
  OptionalSubjectPoliticalScienceAndInternationalRelations: 'Political Science & International Relations',
  OptionalSubjectPsychology: 'Psychology',
  OptionalSubjectPublicAdministration: 'Public Administration',
  OptionalSubjectSociology: 'Sociology',
  OptionalSubjectStatistics: 'Statistics',
  OptionalSubjectZoology: 'Zoology'
};

export default function ProgressUpdater({ syllabusData, refreshSyllabus }) {
  const [updatingKey, setUpdatingKey] = useState(null);
  const [expandedSubject, setExpandedSubject] = useState(null);

  if (!syllabusData || !syllabusData.optionalSubject) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-73px)] text-center p-4">
        <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center border border-indigo-100 mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-6 h-6"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
        </div>
        <h3 className="font-bold text-slate-900">Syllabus Tracker Inactive</h3>
        <p className="text-sm text-slate-500 mt-1">Please choose your Optional Subject in the **Student Dashboard** to activate syllabus tracking.</p>
      </div>
    );
  }

  const completedSet = new Set(syllabusData.completedTopics || []);

  // Format subjects list
  const subjects = [];

  // GS Modules
  Object.keys(syllabusData.gsModules).forEach((gsKey) => {
    const sections = syllabusData.gsModules[gsKey].map((sec) => {
      const topics = sec.topics.map((top) => {
        const topicKey = `${gsKey}|${sec.section}|${top.title}`;
        return {
          title: top.title,
          key: topicKey,
          isCompleted: completedSet.has(topicKey)
        };
      });
      return { sectionName: sec.section, topics };
    });

    subjects.push({
      id: gsKey,
      name: gsKey.replace('-', ' '),
      fullName: gsKey === 'GS-1' ? 'General Studies I (Culture, History, Geography, Society)' :
                gsKey === 'GS-2' ? 'General Studies II (Governance, Constitution, Polity, Social Justice)' :
                gsKey === 'GS-3' ? 'General Studies III (Science & Tech, Economic Dev, Bio-diversity, Security)' :
                'General Studies IV (Ethics, Integrity & Aptitude)',
      sections
    });
  });

  // Optional Subject
  if (syllabusData.optionalData) {
    const optionalName = OPTIONAL_NAMES[syllabusData.optionalSubject] || 'Optional Subject';
    const sections = syllabusData.optionalData.map((sec) => {
      const topics = sec.topics.map((top) => {
        const topicKey = `${syllabusData.optionalSubject}|${sec.section}|${top.title}`;
        return {
          title: top.title,
          key: topicKey,
          isCompleted: completedSet.has(topicKey)
        };
      });
      return { sectionName: sec.section, topics };
    });

    subjects.push({
      id: syllabusData.optionalSubject,
      name: `Optional: ${optionalName}`,
      fullName: `Optional Subject - ${optionalName} Papers`,
      sections
    });
  }

  // Toggle progress API call
  const handleToggleProgress = async (topicKey, isCompleted) => {
    setUpdatingKey(topicKey);
    try {
      const res = await fetch('/api/user/progress', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ topicKey, completed: !isCompleted })
      });
      if (res.ok) {
        // Trigger silent reload of state in parent
        await refreshSyllabus(true);
      }
    } catch (err) {
      console.error('Error toggling progress:', err);
    } finally {
      setUpdatingKey(null);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-6 py-10 md:py-14">
      {/* Header Info */}
      <div className="mb-10">
        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">Syllabus Tracker Manager</h1>
        <p className="text-slate-500 text-sm mt-1.5 font-medium">Click on topics to toggle their completion status and update your learning metrics.</p>
      </div>

      {/* Accordion List of Subjects */}
      <div className="space-y-4">
        {subjects.map((sub) => {
          const isExpanded = expandedSubject === sub.id;
          
          // Calculate stats for header badge
          const topicsList = sub.sections.flatMap(s => s.topics);
          const total = topicsList.length;
          const completed = topicsList.filter(t => t.isCompleted).length;

          return (
            <div key={sub.id} className="bg-white border border-slate-200/85 rounded-2xl overflow-hidden shadow-sm transition-all duration-200">
              {/* Header Accordion Button */}
              <button
                type="button"
                onClick={() => setExpandedSubject(isExpanded ? null : sub.id)}
                className="w-full px-6 py-5 flex items-center justify-between text-left hover:bg-slate-50/40 transition cursor-pointer"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-md px-2 py-0.5 uppercase tracking-wide">{sub.name}</span>
                    <span className="text-[10px] font-bold text-slate-400 bg-slate-50 border border-slate-100 rounded-md px-2 py-0.5 uppercase tracking-wide">{completed} / {total} Completed</span>
                  </div>
                  <h3 className="font-extrabold text-slate-905 text-base">{sub.fullName}</h3>
                </div>
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-50 text-slate-500">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}><polyline points="6 9 12 15 18 9"/></svg>
                </div>
              </button>

              {/* Expansible List */}
              {isExpanded && (
                <div className="px-6 pb-6 pt-2 border-t border-slate-100 bg-slate-50/10 space-y-6">
                  {sub.sections.map((sec, sIdx) => (
                    <div key={sIdx} className="space-y-3">
                      <h4 className="font-bold text-slate-400 text-[10px] uppercase tracking-wider pl-1">{sec.sectionName}</h4>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {sec.topics.map((top) => {
                          const isUpdating = updatingKey === top.key;
                          return (
                            <button
                              key={top.key}
                              type="button"
                              disabled={isUpdating}
                              onClick={() => handleToggleProgress(top.key, top.isCompleted)}
                              className={`w-full p-4 border rounded-xl flex items-center justify-between text-left transition-all duration-200 cursor-pointer disabled:opacity-50 ${
                                top.isCompleted 
                                  ? 'bg-emerald-50/30 border-emerald-200 hover:bg-emerald-50/50 text-slate-900' 
                                  : 'bg-white border-slate-200 hover:border-slate-350 text-slate-700'
                              }`}
                            >
                              <span className="text-xs font-semibold leading-relaxed max-w-[85%]">{top.title}</span>
                              <div className="flex items-center justify-center w-5 h-5 flex-shrink-0">
                                {isUpdating ? (
                                  <div className="w-3.5 h-3.5 border-2 border-indigo-200 border-t-indigo-650 rounded-full animate-spin"></div>
                                ) : top.isCompleted ? (
                                  <div className="w-5 h-5 bg-emerald-500 text-white rounded-full flex items-center justify-center border border-emerald-600">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-3 h-3"><polyline points="20 6 9 17 4 12"/></svg>
                                  </div>
                                ) : (
                                  <div className="w-5 h-5 bg-slate-50 border border-slate-200 rounded-full hover:bg-slate-100"></div>
                                )}
                              </div>
                            </button>
                          );
                        })}
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
  );
}
