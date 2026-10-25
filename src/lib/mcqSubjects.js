// One place for subject display names (this used to be copy-pasted into three files, and one of
// them - the test list - forgot to use it and showed raw keys like "OptionalSubjectSociology").
export const SUBJECT_NAMES = {
  'GS-1': 'GS-1: Culture, History, Geography, Society',
  'GS-2': 'GS-2: Governance, Constitution, Polity, Social Justice',
  'GS-3': 'GS-3: Science & Tech, Economic Dev, Bio-diversity, Security',
  'GS-4': 'GS-4: Ethics, Integrity & Aptitude'
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
  OptionalSubjectZoology: 'Optional: Zoology'
};

// "OptionalSubjectPublicAdministration" -> "Public Administration" as a last resort for unknown keys.
const humanize = (key) => key.replace(/^OptionalSubject/, '').replace(/([a-z])([A-Z])/g, '$1 $2');

export const displaySubjectName = (subject) => SUBJECT_NAMES[subject] || OPTIONAL_NAMES[subject] || humanize(subject || '');

// Card-sized name without the "GS-1:" / "Optional:" prefix.
export const shortSubjectName = (subject) => {
  const full = displaySubjectName(subject);
  return full.replace(/^Optional:\s*/, '').replace(/^GS-\d:\s*/, '');
};

export const subjectGroup = (subject) => (String(subject).startsWith('Optional') ? 'optional' : 'gs');
