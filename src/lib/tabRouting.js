// Every tab string actually used across App.jsx / DashboardSection.jsx / Navbar.jsx.
// There's no react-router in this app - `activeTab` state drives everything, so this
// file exists purely to validate a URL hash against known tabs before trusting it.
const KNOWN_TABS = [
  'login',
  'student',
  'updater',
  'uploader',
  'manage_courses',
  'pyqs',
  'upsc_questions',
  'toppers_copy',
  'my_notes',
  'economy_master',
  'admin_economy_master',
  'admin_test',
  'admin_toppers_copy',
  'buy_pdfs',
  'upload_course',
  'pyq_recommender',
  'pdf_editor',
  'purchase_courses',
  'admin_purchases',
  'admin_view',
  'admin_contact_users',
  'progress',
  'admin_progress_data',
  'admin_mcq_data',
  'admin_question_banks',
];

// Header label for the admin upload panel tab — placeholder name until it's confirmed.
export const TEST_TAB_LABEL = 'Test';

export const DEFAULT_TAB = 'buy_pdfs';

export const isValidTab = (tab) =>
  typeof tab === 'string' && (KNOWN_TABS.includes(tab) || tab.startsWith('mcq_'));

export const readTabFromHash = () => {
  if (typeof window === 'undefined') return DEFAULT_TAB;
  const raw = decodeURIComponent(window.location.hash.replace(/^#/, ''));
  return isValidTab(raw) ? raw : DEFAULT_TAB;
};
