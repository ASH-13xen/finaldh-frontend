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

// The "Fill it in" card on My DAF (typing the DAF in from scratch). Hidden 2026-11-20, back 2026-11-22 at the
// client's request. The roll number can't be typed in: it comes only from the official DAF upload (checked by
// our team). Unlocking still needs that upload to be verified.
export const DAF_FILL_IN_OPTION = true;
