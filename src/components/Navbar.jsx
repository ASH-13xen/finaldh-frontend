const buttonClass = (active) =>
  `text-[9px] sm:text-xs font-semibold px-1.5 py-0.5 sm:px-3 sm:py-1.5 rounded-md md:rounded-xl transition-all cursor-pointer whitespace-nowrap ${
    active ? 'bg-accent-600 text-white shadow-md shadow-accent-950/40' : 'text-slate-350 hover:text-white hover:bg-slate-800'
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

export default function Navbar({ user, onLogout, activeTab, setActiveTab }) {
  const links = getNavLinks(user);
  const activeKey = links.find((l) => l.match(activeTab))?.key;

  const handleLogoClick = () => {
    if (user) {
      setActiveTab(user.isAdmin ? 'manage_courses' : 'student');
    } else {
      setActiveTab('login');
    }
  };

  return (
    <nav className="w-full bg-slate-900 border-b border-slate-800 px-3 md:px-6 py-3 md:py-4 flex items-center justify-between sticky top-0 z-50">
      {/* Brand logo & title */}
      <div className="flex items-center gap-1.5 sm:gap-4 md:gap-6">
        <div onClick={handleLogoClick} className="flex items-center gap-1.5 md:gap-3 cursor-pointer">
          <span className="font-bold text-white tracking-tight text-[11px] md:text-base whitespace-nowrap hidden sm:inline">The Dark Horse UPSC</span>
          <span className="font-bold text-white tracking-tight text-[11px] md:text-base whitespace-nowrap sm:hidden">Dark Horse</span>
        </div>

        {/* Navigation Links */}
        {user && (
          <div className="flex items-center gap-1 sm:gap-2.5 border-l border-slate-800 pl-1.5 sm:pl-4 md:pl-6">
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

      {/* Profile details & Logout / Sign In */}
      <div className="flex items-center gap-1 sm:gap-3">
        {user ? (
          <>
            {user.isAdmin && (
              <span className="hidden sm:inline-block px-1.5 py-0.5 md:px-2.5 md:py-1 bg-rose-950/30 border border-rose-900/50 text-rose-400 rounded-md md:rounded-lg text-[8px] md:text-[10px] font-extrabold uppercase tracking-wide whitespace-nowrap">
                Admin Mode Active
              </span>
            )}
            <img
              src={user.picture || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.name)}`}
              alt={user.name}
              className="w-6 h-6 md:w-8 md:h-8 rounded-full border border-slate-800 object-cover"
            />
            <button
              onClick={onLogout}
              className="flex items-center gap-1 py-0.5 px-1.5 sm:py-1.5 sm:px-3 text-slate-350 hover:text-white hover:bg-slate-800 border border-transparent hover:border-slate-800 rounded-md md:rounded-lg text-[9px] sm:text-xs font-semibold transition-all duration-200 cursor-pointer whitespace-nowrap"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 md:w-3.5 md:h-3.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </>
        ) : (
          <button
            onClick={() => setActiveTab('login')}
            className="flex items-center gap-1 py-0.5 px-1.5 sm:py-1.5 sm:px-3 bg-accent-600 text-white hover:bg-accent-500 rounded-md md:rounded-lg text-[9px] sm:text-xs font-semibold transition-all duration-200 cursor-pointer shadow-sm whitespace-nowrap"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3 md:w-3.5 md:h-3.5"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
            <span className="hidden sm:inline">Sign In</span>
          </button>
        )}
      </div>
    </nav>
  );
}
