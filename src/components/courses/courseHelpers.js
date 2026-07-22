export const SUBJECT_NAMES = {
  'GS-1': 'GS-1: Culture, History, Geography, Society',
  'GS-2': 'GS-2: Governance, Constitution, Polity, Social Justice',
  'GS-3': 'GS-3: Science & Tech, Economic Dev, Bio-diversity, Security',
  'GS-4': 'GS-4: Ethics, Integrity & Aptitude',
};

export const OPTIONAL_NAMES = {
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
  OptionalSubjectZoology: 'Optional: Zoology',
};

export const isOptionalSubject = (subject) => subject?.startsWith('OptionalSubject');
export const isGsCoreSubject = (subject) =>
  subject?.startsWith('GS-') || subject === 'Essay' || subject === 'All GS';

export const categorizeCourses = (courses, excludedIds = []) => ({
  optional: courses.filter((c) => isOptionalSubject(c.subject)),
  gsCore: courses.filter((c) => isGsCoreSubject(c.subject) && !excludedIds.includes(c._id)),
  other: courses.filter((c) => !isGsCoreSubject(c.subject) && !isOptionalSubject(c.subject)),
});

export const subjectDisplayName = (subject) =>
  subject?.startsWith('GS-') ? subject : OPTIONAL_NAMES[subject]?.replace('Optional: ', '') || subject;

export const MMF_FEATURES = [
  'Syllabus-wise & Topic-wise Compilation of prominent Mains Test Series summaries for streamlined revision.',
  'Quick Revision Boxes (QRBs) after every topic, containing important keywords, examples, and value-addition points for rapid recall.',
  'Dedicated Notes Space to help you incorporate additional value-addition points from your own preparation.',
  'Enhanced Content Coverage with carefully curated additions from our side to ensure a more comprehensive understanding of every topic.',
  'Dedicated Group for Value Addition Pointers.',
];

export const CAC_FEATURES = [
  '"Mains 365 Plus" Summary — Precise, Exam-Oriented with Complete Coverage.',
  'PYQ Linkage — PYQs, Value Addition Box and Keywords all arranged Topic-Wise for better utility of the content.',
  'Brainstorming Sheets — Carefully curated List of Probable Mains questions for Brainstorming and active learning. (with Value Addition)',
  'Additional Topics from Relevant sources and editorials in One-Pager Format in Dedicated Group.',
];
