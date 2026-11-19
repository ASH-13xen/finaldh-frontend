// Switches for sections that are built but not open to students yet.

// MCQ test series. While false, every MCQ page (the navbar's "MCQ Tests" and any direct mcq_* link) shows
// "Coming Soon" to everyone, admins included; admins can still build tests and pricing under Manage MCQ.
// Set to true to launch it.
export const MCQ_SECTION_LIVE = false;

// Interview Prep (DAF, predicted questions, question bank, practice, notes). Launched 2026-11-20: open to every
// signed-in student. Set to false to hide it from students again (admins keep it); the backend closes its API
// to students when INTERVIEW_SECTION_LIVE=false is set in its environment.
export const INTERVIEW_SECTION_LIVE = true;
