import { useEffect, useRef } from 'react';
import { gsap, prefersReducedMotion } from '../lib/gsapSetup';
import { useTheme } from '../contexts/ThemeContext';

const buttonClass = (active) =>
  `text-[9px] sm:text-xs font-sans font-semibold px-1.5 py-0.5 sm:px-3 sm:py-1.5 rounded-md md:rounded-lg transition-all duration-200 cursor-pointer whitespace-nowrap ${
    active ? 'bg-brand text-text-on-accent shadow-sm' : 'text-text-secondary hover:text-text-primary hover:bg-surface-raised'
  }`;

const getNavLinks = (user) => {
  if (!user) return [];

  const links = [
    {
      key: 'student',
      target: 'student',
      match: (t) => t === 'student',
      label: <><span className="hidden sm:inline">Student's </span>Dashboard</>
    },
    {
      key: 'progress',
      target: 'progress',
      match: (t) => t === 'progress',
      label: 'Progress'
    },
    {
      key: 'mcq',
      target: 'mcq_tests',
      match: (t) => t?.startsWith('mcq_'),
      label: 'MCQ Tests'
    }
  ];

  if (!user.isAdmin) {
    links.push({
      key: 'purchase',
      target: 'purchase_courses',
      match: (t) => t === 'purchase_courses',
      label: <><span className="hidden sm:inline">Purchase </span>Courses</>
    });
  }

  if (user.isAdmin) {
    links.push(
      {
        key: 'manage',
        target: 'manage_courses',
        match: (t) => t === 'manage_courses',
        label: <><span className="hidden sm:inline">Manage </span>Courses</>
      },
      {
        key: 'progress_data',
        target: 'admin_progress_data',
        match: (t) => t === 'admin_progress_data',
        label: <><span className="hidden sm:inline">Progress </span>Data</>
      },
      {
        key: 'requests',
        target: 'admin_purchases',
        match: (t) => t === 'admin_purchases',
        label: <><span className="hidden sm:inline">Purchase </span>Requests</>
      },
      {
        key: 'admin_view',
        target: 'admin_view',
        match: (t) => t === 'admin_view',
        label: <><span className="hidden sm:inline">Admin </span>View</>
      }
    );
  }

  return links;
};

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="relative w-7 h-7 md:w-8 md:h-8 flex items-center justify-center rounded-full border border-border-default text-text-secondary hover:text-text-primary hover:bg-surface-raised transition-all duration-200 cursor-pointer shrink-0"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        className={`w-3.5 h-3.5 md:w-4 md:h-4 absolute transition-all duration-300 ${isDark ? 'opacity-0 rotate-90 scale-50' : 'opacity-100 rotate-0 scale-100'}`}
      >
        <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
      </svg>
      <svg
        xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        className={`w-3.5 h-3.5 md:w-4 md:h-4 absolute transition-all duration-300 ${isDark ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-50'}`}
      >
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    </button>
  );
}

export default function Navbar({ user, onLogout, activeTab, setActiveTab }) {
  const links = getNavLinks(user);
  const activeKey = links.find((l) => l.match(activeTab))?.key;
  const navRef = useRef(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (hasAnimated.current || !navRef.current) return;
    hasAnimated.current = true;
    if (prefersReducedMotion()) return;
    gsap.from(navRef.current, { opacity: 0, y: -8, duration: 0.35, ease: 'power2.out' });
  }, []);

  const handleLogoClick = () => {
    if (user) {
      setActiveTab(user.isAdmin ? 'manage_courses' : 'student');
    } else {
      setActiveTab('login');
    }
  };

  return (
    <nav ref={navRef} className="w-full bg-surface border-b border-border-default px-3 md:px-6 py-3 md:py-4 flex items-center justify-between sticky top-0 z-50">
      {/* Brand logo & title */}
      <div className="flex items-center gap-1.5 sm:gap-4 md:gap-6">
        <div onClick={handleLogoClick} className="flex items-center gap-1.5 md:gap-3 cursor-pointer">
          <span className="font-display font-semibold text-text-primary tracking-tight text-sm md:text-lg whitespace-nowrap hidden sm:inline">The Dark Horse UPSC</span>
          <span className="font-display font-semibold text-text-primary tracking-tight text-sm md:text-lg whitespace-nowrap sm:hidden">Dark Horse</span>
        </div>

        {/* Navigation Links */}
        {user && (
          <div className="flex items-center gap-1 sm:gap-2.5 border-l border-border-default pl-1.5 sm:pl-4 md:pl-6">
            {links.map((link) => (
              <button
                key={link.key}
                onClick={() => setActiveTab(link.target)}
                className={buttonClass(link.key === activeKey)}
              >
                {link.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Profile details, theme toggle & Logout / Sign In */}
      <div className="flex items-center gap-1.5 sm:gap-3">
        <ThemeToggle />
        {user ? (
          <>
            {user.isAdmin && (
              <span className="hidden sm:inline-block px-1.5 py-0.5 md:px-2.5 md:py-1 bg-status-danger-bg border border-status-danger-text/30 text-status-danger-text rounded-md md:rounded-lg text-[8px] md:text-[10px] font-sans font-extrabold uppercase tracking-wide whitespace-nowrap">
                Admin Mode Active
              </span>
            )}
            <img
              src={user.picture || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.name)}`}
              alt={user.name}
              className="w-6 h-6 md:w-8 md:h-8 rounded-full border border-border-default object-cover"
            />
            <button
              onClick={onLogout}
              className="flex items-center gap-1 py-0.5 px-1.5 sm:py-1.5 sm:px-3 text-text-secondary hover:text-text-primary hover:bg-surface-raised border border-transparent hover:border-border-default rounded-md md:rounded-lg text-[9px] sm:text-xs font-sans font-semibold transition-all duration-200 cursor-pointer whitespace-nowrap"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 md:w-3.5 md:h-3.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </>
        ) : (
          <button
            onClick={() => setActiveTab('login')}
            className="flex items-center gap-1 py-0.5 px-1.5 sm:py-1.5 sm:px-3 bg-brand text-text-on-accent hover:bg-brand-hover rounded-md md:rounded-lg text-[9px] sm:text-xs font-sans font-semibold transition-all duration-200 cursor-pointer shadow-sm whitespace-nowrap"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 md:w-3.5 md:h-3.5"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
            <span className="hidden sm:inline">Sign In</span>
          </button>
        )}
      </div>
    </nav>
  );
}
