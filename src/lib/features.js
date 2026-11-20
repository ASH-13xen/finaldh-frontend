// Switches for sections that are built but not open to students yet.

// MCQ test series. While false, every MCQ page (the navbar's "MCQ Tests" and any direct mcq_* link) shows
// "Coming Soon" to everyone, admins included; admins can still build tests and pricing under Manage MCQ.
// Set to true to launch it.
export const MCQ_SECTION_LIVE = false;

// Interview Prep (DAF, predicted questions, question bank, practice, notes). Launched 2026-11-20: open to every
// signed-in student. Set to false to hide it from students again (admins keep it); the backend closes its API
// to students when INTERVIEW_SECTION_LIVE=false is set in its environment.
export const INTERVIEW_SECTION_LIVE = true;

// Current-topic notes in Interview Prep's Notes tab. While false, Notes shows only the 100-question guide (to
// everyone, admins included - the admin desk for drafting notes is hidden too) and nothing else in the site
// mentions current topics. Notes already written stay in the database. Set to true to bring them back.
// Hidden 2026-11-20 at the client's request.
export const CURRENT_TOPICS_LIVE = false;

// The "Fill it in" card on My DAF (typing the DAF in from scratch). While false, students can only upload their
// DAF - which they need anyway to get it verified. The form itself stays: students check what AI read from the
// upload in it, use it for "Edit DAF", and get it when AI can't read the file. Hidden 2026-11-20 at the
// client's request; set to true to offer it again.
export const DAF_FILL_IN_OPTION = false;
