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

            return (
              <div
                key={course._id}
                className="bg-slate-900/50 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between hover:border-slate-700 transition-all duration-200"
              >
                <div className="space-y-3 flex-grow">
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

                <div className="border-t border-slate-800/60 pt-4 mt-4 flex items-center justify-between">
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
    </div>
  );
}
