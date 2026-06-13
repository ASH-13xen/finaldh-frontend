import { useState, useEffect } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';

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

export default function BuyCourses({ onRedirectToLogin }) {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const res = await fetch('/api/courses/list');
        if (res.ok) {
          const data = await res.json();
          setCourses(data.courses || []);
        }
      } catch (err) {
        console.error('Error fetching courses:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchCourses();
  }, []);

  return (
    <div className="w-full max-w-5xl mx-auto px-6 py-10 md:py-14">
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">Course PDFs</h1>
        <p className="text-slate-400 text-sm mt-1.5 font-medium">Study packages and syllabus guides compiled by subject experts. Sign in to purchase.</p>
      </div>

      {loading ? (
        <div className="py-16 text-center">
          <LoadingSpinner text="Loading courses..." />
        </div>
      ) : courses.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-slate-800 rounded-2xl">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-10 h-10 mx-auto mb-3 text-slate-600"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M6 6h10"/><path d="M6 10h10"/></svg>
          <p className="text-sm font-semibold text-slate-400">No courses available yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {courses.map((course) => {
            const isGS = course.subject.startsWith('GS-');
            const subjectDisplay = isGS
              ? course.subject
              : OPTIONAL_NAMES[course.subject]?.replace('Optional: ', '') || course.subject;

            const pdfNames = course.fileNames && course.fileNames.length > 0
              ? course.fileNames
              : [course.fileName || course.name];

            return (
              <div
                key={course._id}
                className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 flex flex-col gap-4 hover:border-slate-700 transition-all duration-200"
              >
                {/* Header */}
                <div className="space-y-2">
                  <span className="text-[9px] font-bold text-indigo-400 bg-indigo-950/50 border border-indigo-900/50 rounded px-1.5 py-0.5 uppercase tracking-wide w-fit block">
                    {subjectDisplay}
                  </span>
                  <h3 className="text-sm font-bold text-slate-100 leading-snug">
                    {course.name || course.fileName}
                  </h3>
                  {course.discountLimitTag && (
                    <div className="flex items-center gap-1.5 bg-amber-950/30 border border-amber-800/40 text-amber-400 text-[10px] font-semibold px-2 py-0.5 rounded-lg w-fit">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3 h-3"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                      First 50 students discount
                    </div>
                  )}
                </div>

                {/* PDF file list with locked buttons */}
                <div className="space-y-2">
                  {pdfNames.map((name, idx) => (
                    <div key={idx} className="bg-slate-950/50 border border-slate-800/60 rounded-xl px-3 py-2.5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5 text-slate-500 shrink-0"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                        <span className="text-[11px] font-semibold text-slate-300 truncate">{name}</span>
                      </div>
                      <button
                        onClick={onRedirectToLogin}
                        className="shrink-0 flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-slate-200 rounded-lg text-[10px] font-bold transition-all cursor-pointer whitespace-nowrap"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3 h-3"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                        Locked
                      </button>
                    </div>
                  ))}
                </div>

                {/* Price + Sign In */}
                <div className="border-t border-slate-800/60 pt-3 flex items-center justify-between">
                  <div>
                    {course.useDiscount ? (
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-base font-extrabold text-indigo-400">₹{course.discountedPrice}</span>
                        <span className="text-[10px] text-slate-500 line-through">₹{course.price}</span>
                      </div>
                    ) : (
                      <span className="text-base font-extrabold text-slate-100">₹{course.price || 499}</span>
                    )}
                  </div>
                  <button
                    onClick={onRedirectToLogin}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer flex items-center gap-1.5"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
                    Sign In to Purchase
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Sample PDF */}
      <div className="mt-12 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-indigo-400"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
            <span className="text-sm font-bold text-slate-200">Sociology Paper 1 — Free Sample</span>
          </div>
          <a
            href="/TCC - Sociology Paper 1 (Sample).pdf"
            download
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white rounded-lg text-[11px] font-bold transition-all cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Download
          </a>
        </div>
        <iframe
          src="/TCC - Sociology Paper 1 (Sample).pdf"
          className="w-full"
          style={{ height: '700px' }}
          title="Sociology Paper 1 Sample PDF"
        />
      </div>

      {/* Footer */}
      <div className="mt-10 pt-6 border-t border-slate-800/60 text-center">
        <p className="text-sm text-slate-200 font-extrabold tracking-wide flex flex-col sm:flex-row items-center justify-center gap-2">
          <span>In case of any issue, contact us on Telegram:</span>
          <span className="flex items-center gap-2">
            <a
              href="https://t.me/tdhadmin"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-950/45 border border-indigo-900/60 text-indigo-400 hover:text-indigo-300 rounded-lg text-xs font-black shadow transition-all hover:scale-[1.02] cursor-pointer"
            >
              Telegram App (Mobile)
            </a>
            <span className="text-slate-700 font-medium hidden sm:inline">|</span>
            <a
              href="https://web.telegram.org/k/#@tdhadmin"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-950/45 border border-indigo-900/60 text-indigo-400 hover:text-indigo-300 rounded-lg text-xs font-black shadow transition-all hover:scale-[1.02] cursor-pointer"
            >
              Telegram Web
            </a>
          </span>
        </p>
      </div>
    </div>
  );
}
