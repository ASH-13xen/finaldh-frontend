// Switches for sections that are built but not open to students yet.

// MCQ test series. While false, every MCQ page (the navbar's "MCQ Tests" and any direct mcq_* link) shows
// "Coming Soon" to everyone, admins included; admins can still build tests and pricing under Manage MCQ.
// Set to true to launch it.
export const MCQ_SECTION_LIVE = false;

// Mock Interview (DAF, predicted questions, question bank, voice/text mock interviews). While false, only
// admins see it (navbar link and pages); a student who opens an interview_* link gets "Coming Soon".
// To launch, set this to true AND set INTERVIEW_SECTION_LIVE=true in the backend's environment (Render) -
// the API refuses students until then.
export const INTERVIEW_SECTION_LIVE = false;
