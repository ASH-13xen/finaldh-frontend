// The step-by-step tours, one per tab. A step points at the part of the screen marked data-tour="<target>";
// a step without a target shows as a card on its own. A step whose target isn't on this student's screen (say,
// no interview date yet, or a panel that only exists on phones) is skipped. `ready` names the part that must be
// on screen before a tour opens by itself - so a tab that is still locked, or still loading, never uses it up.
// Plain English, and never a word about credits or prices.
export const TOURS = {
  home: {
    ready: 'home-tools',
    steps: [
      { title: 'Welcome to Abhivyakti', body: 'Your UPSC interview preparation in one place. This short tour shows you around. It takes a minute.' },
      { target: 'home-interview', title: 'Your interview', body: 'Your interview date, session and a live countdown appear here once your DAF and roll number are verified.' },
      { target: 'home-tools', title: 'Everything in six tools', body: 'Each tile opens one part of your preparation. Start with My DAF, then your predicted questions.' },
      { target: 'home-qotd', title: 'Question of the day', body: 'A real question boards keep asking. Think of your answer, then see where it was asked.' },
      { target: 'tour-button', title: 'Help on every tab', body: 'Every tab has its own short tour like this one. Tap “How it works” whenever you want to see it again.' }
    ]
  },
  daf: {
    ready: 'daf-status',
    steps: [
      { title: 'My DAF', body: 'Everything in Abhivyakti is built from your DAF, so it comes first.' },
      { target: 'daf-start', title: 'Give your DAF once', body: 'Upload it and we read the details from it, or fill it in yourself. You only do this once.' },
      { target: 'daf-status', title: 'Our team verifies it', body: 'We check that it is a genuine DAF. Once it is verified, your predicted questions, practice and the full question bank open.' },
      { target: 'daf-heatmap', title: 'Your DAF, part by part', body: 'How often boards asked about each part of your DAF when candidates listed it. The deeper the colour, the more they dig in.' },
      { target: 'daf-reupload', title: 'If your DAF changes', body: 'Your DAF details can’t be edited. If your DAF changes, upload it again and our team verifies it again.' }
    ]
  },
  predictions: {
    ready: 'pred-tiers',
    steps: [
      { title: 'Your predicted questions', body: 'About a hundred questions written for your DAF, based on what boards really asked candidates like you.' },
      { target: 'pred-rail', title: 'Your DAF topics', body: 'Jump to any part of your DAF from here. Fold this panel away with the arrow to give the questions more room.' },
      { target: 'pred-rail-phone', title: 'Your DAF topics', body: 'Tap here to jump to any part of your DAF.' },
      { target: 'pred-tiers', title: 'How likely each question is', body: 'Almost certain, likely, or worth preparing. Tap a box to see only those questions.' },
      { target: 'pred-topic', title: 'Topics open and close', body: 'Tap a topic to open or close its questions, so the page stays easy to read.' },
      { target: 'pred-card', title: 'Open a question', body: 'Tap a question for a tip on answering it, and to mark it as practised. Your progress is saved.' },
      { target: 'pred-followups', title: 'The follow-up questions', body: 'Every question comes with the 2 questions the board is likely to ask next. Tap here to see them. You can practise them too.' },
      { target: 'pred-deepdive', title: 'Deep dive', body: 'See the real interviews where this was asked, and how candidates answered.' },
      { target: 'pred-views', title: 'Three ways to study', body: 'By DAF topic, as one ranked list, or as flashcards. Flashcards show the follow-ups on the back.' }
    ]
  },
  bank: {
    ready: 'bank-search',
    steps: [
      { title: 'Question Bank', body: 'Every question asked in real UPSC interviews, all in one place.' },
      { target: 'bank-search', title: 'Search', body: 'Type anything: a topic, a place, a hobby, an optional subject.' },
      { target: 'bank-tabs', title: 'Questions, topics and boards', body: 'Browse questions by topic, or see each board, who chairs it and how candidates found it.' },
      { target: 'bank-filters', title: 'Filters', body: 'Narrow the questions by year, board, type of question and more.' },
      { target: 'bank-card', title: 'Save what matters', body: 'Save a question with its bookmark. Your saved questions wait for you in My Prep.' }
    ]
  },
  practice: {
    ready: 'pr-picker',
    steps: [
      { title: 'Practice Studio', body: 'Answer out loud, like in the real interview, and see how you did.' },
      { target: 'pr-picker', title: 'Pick a question', body: 'From your predicted questions, the questions boards ask most, short drills, or a question of your own.' },
      { target: 'pr-stage', title: 'Record your answer', body: 'Answer for up to 3 minutes. You see your pace, filler words and more, and you can ask for detailed feedback.' },
      { title: 'Then the follow-ups', body: 'After a predicted question, Practice Studio shows what the board may ask next. Practise those too, just like a real interview.' },
      { target: 'pr-progress', title: 'Your progress', body: 'See how your answers improve over time.' }
    ]
  },
  notes: {
    ready: 'notes-guide',
    steps: [
      { title: 'Notes', body: 'Short, clear notes for your interview, starting with how to answer the questions boards ask most.' },
      { target: 'notes-tabs', title: 'Two kinds of notes', body: 'Current topics, and how to answer the most-asked questions.' },
      { target: 'notes-guide', title: 'Open any question', body: 'Tap a question to see how to structure your answer, and what to do and avoid.' },
      { target: 'notes-download', title: 'Download a PDF', body: 'Save the whole guide as a PDF to read any time, even offline.' }
    ]
  },
  insights: {
    ready: 'in-first',
    steps: [
      { title: 'Insights', body: 'What UPSC boards actually ask, counted from real interviews.' },
      { target: 'in-first', title: 'Each finding opens', body: 'Tap a finding to open or close it. This one shows how often boards ask about each part of a DAF.' },
      { title: 'And how it is changing', body: 'Further down: the topics, hobbies, optional subjects and boards, and what was new in the latest year.' }
    ]
  },
  me: {
    ready: 'me-countdown',
    steps: [
      { title: 'My Prep', body: 'Your countdown, plan and progress in one place.' },
      { target: 'me-countdown', title: 'Countdown and readiness', body: 'Set your interview date, and see how many of your predicted questions you have prepared.' },
      { target: 'me-plan', title: 'Your study plan', body: 'A day-by-day plan built from your DAF. Tasks tick themselves as you prepare.' },
      { target: 'me-saved', title: 'Saved questions and notes', body: 'Everything you saved or wrote notes on, in one list.' },
      { target: 'me-practice', title: 'Practice so far', body: 'Your recorded answers, and a quick way back to Practice Studio.' }
    ]
  }
};

// "How it works" (and anything else) starts the tour of the tab on screen.
export const TOUR_START = 'prep:tour';
export const startTour = () => window.dispatchEvent(new CustomEvent(TOUR_START));
export const hasTour = (screen) => !!TOURS[screen];
