import { useState, useEffect, useRef } from 'react';
import { gsap, prefersReducedMotion } from '../lib/gsapSetup';
import { useTheme } from '../contexts/ThemeContext';
import InboxBell from './InboxBell';

const buttonClass = (active) =>
  `text-[9px] sm:text-xs font-sans font-semibold px-1.5 py-0.5 sm:px-3 sm:py-1.5 rounded-md md:rounded-lg transition-all duration-200 cursor-pointer whitespace-nowrap ${
    active ? 'bg-brand text-text-on-accent shadow-sm' : 'text-text-secondary hover:text-text-primary hover:bg-surface-raised'
  }`;

const mobileButtonClass = (active) =>
  `w-full text-left font-sans font-semibold px-4 py-3 rounded-xl transition-all duration-200 cursor-pointer flex items-center justify-between border ${
    active ? 'bg-brand text-text-on-accent border-brand shadow-sm' : 'text-text-secondary hover:text-text-primary hover:bg-surface-raised border-border-default'
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
      },
      {
        key: 'contact_users',
        target: 'admin_contact_users',
        match: (t) => t === 'admin_contact_users',
        label: <><span className="hidden sm:inline">Contact </span>User</>
      }
    );
  }

  return links;
};

// Custom click outside hook to close mobile dropdown
function useClickOutside(ref, handler) {
  useEffect(() => {
    const listener = (event) => {
      if (!ref.current || ref.current.contains(event.target)) {
        return;
      }
      handler(event);
    };
    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);
    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref, handler]);
}

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
  const mobileMenuRef = useRef(null);
  const hasAnimated = useRef(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (hasAnimated.current || !navRef.current) return;
    hasAnimated.current = true;
    if (prefersReducedMotion()) return;
    gsap.from(navRef.current, { opacity: 0, y: -8, duration: 0.35, ease: 'power2.out' });
  }, []);

  // Close mobile menu on click outside
  useClickOutside(mobileMenuRef, () => {
    setMobileMenuOpen(false);
  });

  const handleLogoClick = () => {
    setMobileMenuOpen(false);
    if (user) {
      setActiveTab(user.isAdmin ? 'manage_courses' : 'student');
    } else {
      setActiveTab('login');
    }
  };

  return (
    <nav ref={navRef} className="w-full bg-surface border-b border-border-default px-4 md:px-6 py-3 md:py-4 flex items-center justify-between sticky top-0 z-50">
      {/* Brand logo & title */}
      <div className="flex items-center gap-1.5 sm:gap-4 md:gap-6">
        <div onClick={handleLogoClick} className="flex items-center gap-1.5 md:gap-3 cursor-pointer">
          <img src="/logodh1.jpg" alt="Dark Horse UPSC" className="w-7 h-7 md:w-9 md:h-9 rounded-full object-cover border border-border-default shrink-0" />
          <span className="font-display font-semibold text-text-primary tracking-tight text-sm md:text-lg whitespace-nowrap hidden sm:inline">The Dark Horse UPSC</span>
          <span className="font-display font-semibold text-text-primary tracking-tight text-sm md:text-lg whitespace-nowrap sm:hidden">Dark Horse</span>
        </div>

        {/* Navigation Links - Desktop Only */}
        {user && (
          <div className="hidden md:flex items-center gap-2 border-l border-border-default pl-6">
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
      <div ref={mobileMenuRef} className="flex items-center gap-1.5 sm:gap-3 relative">
        <ThemeToggle />
        {user && <InboxBell user={user} />}
        {user ? (
          <>
            {user.isAdmin && (
              <span className="hidden md:inline-block px-2 py-1 bg-status-danger-bg border border-status-danger-text/30 text-status-danger-text rounded-lg text-[10px] font-sans font-extrabold uppercase tracking-wide whitespace-nowrap">
                Admin Mode Active
              </span>
            )}
            <img
              src={user.picture || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.name)}`}
              alt={user.name}
              className="hidden md:block w-8 h-8 rounded-full border border-border-default object-cover"
            />
            <button
              onClick={onLogout}
              className="hidden md:flex items-center gap-1.5 py-1.5 px-3 text-text-secondary hover:text-text-primary hover:bg-surface-raised border border-border-default rounded-lg text-xs font-sans font-semibold transition-all duration-200 cursor-pointer whitespace-nowrap"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              <span>Sign Out</span>
            </button>

            {/* Hamburger Menu Toggle - Mobile Only */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-1.5 rounded-lg border border-border-default text-text-secondary hover:text-text-primary hover:bg-surface-raised transition duration-200 cursor-pointer shrink-0"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
              )}
            </button>

            {/* Mobile Dropdown Panel */}
            {mobileMenuOpen && (
              <div className="absolute top-[calc(100%+12px)] right-0 w-64 bg-surface border border-border-default rounded-2xl shadow-2xl p-4 md:hidden flex flex-col gap-4 animate-in fade-in slide-in-from-top-2 duration-200 z-50">
                {user.isAdmin && (
                  <div className="px-3 py-1.5 bg-status-danger-bg border border-status-danger-text/25 text-status-danger-text rounded-xl text-[9px] font-sans font-extrabold uppercase tracking-wide text-center">
                    Admin Mode Active
                  </div>
                )}
                
                <div className="flex flex-col gap-2">
                  {links.map((link) => (
                    <button
                      key={link.key}
                      onClick={() => {
                        setActiveTab(link.target);
                        setMobileMenuOpen(false);
                      }}
                      className={mobileButtonClass(link.key === activeKey)}
                    >
                      <span>{link.label}</span>
                      {link.key === activeKey && (
                        <span className="w-1.5 h-1.5 rounded-full bg-text-on-accent animate-pulse"></span>
                      )}
                    </button>
                  ))}
                </div>

                <div className="border-t border-border-default pt-4 flex flex-col gap-3">
                  <div className="flex items-center gap-2 px-1">
                    <img
                      src={user.picture || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.name)}`}
                      alt={user.name}
                      className="w-8 h-8 rounded-full border border-border-default object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-text-primary truncate">{user.name}</p>
                      <p className="text-[9px] text-text-tertiary truncate">{user.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onLogout();
                    }}
                    className="w-full flex items-center justify-center gap-1.5 py-2 px-4 text-status-danger-text bg-status-danger-bg hover:bg-status-danger-bg/80 border border-status-danger-text/20 rounded-xl text-xs font-sans font-bold transition-all duration-200 cursor-pointer"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <button
            onClick={() => setActiveTab('login')}
            className="flex items-center gap-1.5 py-1.5 px-3.5 bg-brand hover:bg-brand-hover text-text-on-accent rounded-lg text-xs font-sans font-bold transition-all duration-200 cursor-pointer shadow-sm whitespace-nowrap"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
            <span>Sign In</span>
          </button>
        )}
      </div>
    </nav>
  );
}
