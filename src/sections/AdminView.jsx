import { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import LoadingSpinner from '../components/LoadingSpinner';

export default function AdminView() {
  // Navigation: 'transactions' or 'users'
  const [currentView, setCurrentView] = useState('transactions');
  
  // Data States
  const [transactions, setTransactions] = useState([]);
  const [users, setUsers] = useState([]);
  const [courses, setCourses] = useState([]); // List of courses to map in user editor
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Search & Filter States
  const [userSearch, setUserSearch] = useState('');
  const [txnSearch, setTxnSearch] = useState('');
  const [txnStatusFilter, setTxnStatusFilter] = useState('all');
  // Multi-select course filter. Empty array = no filter (show everyone). Entries are either
  // a real courseId, '__others__' (unrecognized/stray course-id strings on a user that don't
  // match any current Course), or '__no_course__' (interestedCourses is empty).
  const [selectedCourseKeys, setSelectedCourseKeys] = useState([]);

  // Interactive States
  const [processingTxnId, setProcessingTxnId] = useState(null);
  const [editingUser, setEditingUser] = useState(null); // stores user being edited
  const [lightboxImage, setLightboxImage] = useState(null);

  // Load list of all courses for mapping
  const fetchCourses = async () => {
    try {
      const res = await fetch('/api/courses/list');
      if (res.ok) {
        const data = await res.json();
        setCourses(data.courses || []);
      }
    } catch (err) {
      console.error('Error fetching course list:', err);
    }
  };

  // Fetch Transactions
  const fetchTransactions = async () => {
    setError('');
    try {
      const res = await fetch('/api/courses/admin/purchase-requests', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to fetch purchase requests');
      }
      const data = await res.json();
      setTransactions(data || []);
    } catch (err) {
      console.error('Error fetching admin requests:', err);
      setError(err.message || 'Failed to load purchase requests.');
    }
  };

  // Fetch Users
  const fetchUsers = async () => {
    setError('');
    try {
      const res = await fetch('/api/user/admin/users', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to fetch users');
      }
      const data = await res.json();
      setUsers(data || []);
    } catch (err) {
      console.error('Error fetching admin users:', err);
      setError(err.message || 'Failed to load users list.');
    }
  };

  // Initial load & view switching
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchCourses();
      if (currentView === 'transactions') {
        await fetchTransactions();
      } else {
        await fetchUsers();
      }
      setLoading(false);
    };
    loadData();
  }, [currentView]);

  // Handle Approve/Reject for Purchase Requests
  const handleTxnStatus = async (requestId, action) => {
    setProcessingTxnId(requestId);
    try {
      const res = await fetch(`/api/courses/admin/purchase-requests/${requestId}/${action}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Failed to ${action} request`);
      }
      
      // Update local state instantly
      setTransactions(prev => prev.map(r => r._id === requestId ? { ...r, status: action === 'approve' ? 'approved' : 'rejected' } : r));
    } catch (err) {
      alert(err.message || `Error executing action ${action}`);
    } finally {
      setProcessingTxnId(null);
    }
  };

  // Handle Highlighting color changes for Purchase Requests
  const handleHighlight = async (requestId, color) => {
    try {
      const res = await fetch(`/api/courses/admin/purchase-requests/${requestId}/highlight`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ highlight: color })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update highlight');
      }
      
      // Update local state
      setTransactions(prev => prev.map(r => r._id === requestId ? { ...r, highlight: color } : r));
    } catch (err) {
      alert(err.message || 'Error updating highlight color');
    }
  };

  // Handle Saving User Profile Updates
  const handleSaveUser = async (userId, updatedData) => {
    try {
      const res = await fetch(`/api/user/admin/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(updatedData)
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update user profile');
      }
      
      // Update local state
      setUsers(prev => prev.map(u => u._id === userId ? data.user : u));
      setEditingUser(null);
    } catch (err) {
      alert(err.message || 'Error saving user profile');
    }
  };

  // Helper: zoom screenshot image. Screenshots are served from an authenticated API route
  // (DB-backed, not a static file), so <img> needs the token as a query param since it
  // can't send an Authorization header.
  const getImageUrl = (path) => {
    if (!path) return '';
    const token = localStorage.getItem('token');
    const withToken = (url) => (token ? `${url}${url.includes('?') ? '&' : '?'}token=${token}` : url);
    if (path.startsWith('http://') || path.startsWith('https://')) return withToken(path);
    const apiBaseUrl = import.meta.env.VITE_API_URL || '';
    return withToken(`${apiBaseUrl.replace(/\/$/, '')}${path}`);
  };

  const copyToClipboard = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
  };

  // Filtering Logic: Transactions
  const filteredTransactions = transactions.filter(t => {
    const matchesSearch = 
      (t.userName || '').toLowerCase().includes(txnSearch.toLowerCase()) ||
      (t.userEmail || '').toLowerCase().includes(txnSearch.toLowerCase()) ||
      (t.upiTxnId || '').toLowerCase().includes(txnSearch.toLowerCase()) ||
      (t.courseName || '').toLowerCase().includes(txnSearch.toLowerCase());
    
    const matchesStatus = txnStatusFilter === 'all' || t.status === txnStatusFilter;
    return matchesSearch && matchesStatus;
  });

  // Get all unique strings in interestedCourses across all loaded users + all courses in database
  const getUniqueCourseIds = () => {
    const ids = [];
    const seen = new Set();
    courses.forEach(c => {
      if (!c.courseId) return;
      const normalized = c.courseId.trim().toLowerCase();
      if (!seen.has(normalized)) {
        seen.add(normalized);
        ids.push(c.courseId.trim());
      }
    });
    users.forEach(u => {
      (u.interestedCourses || []).forEach(cid => {
        if (!cid) return;
        const normalized = cid.trim().toLowerCase();
        if (!seen.has(normalized)) {
          seen.add(normalized);
          ids.push(cid.trim());
        }
      });
    });
    return ids;
  };

  const uniqueCourseIds = getUniqueCourseIds();

  // Resolve a user's interestedCourses into the keys used by the filter/stats
  const getUserCourseKeys = (u) => {
    const ic = u.interestedCourses || [];
    if (ic.length === 0) return ['__no_course__'];
    return ic.map(cid => {
      const found = uniqueCourseIds.find(key => key.toLowerCase() === cid.toLowerCase());
      return found || cid;
    });
  };

  const toggleCourseKey = (key) => {
    setSelectedCourseKeys(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };
  const selectAllCourseKeys = () => setSelectedCourseKeys([...uniqueCourseIds, '__no_course__']);
  const clearCourseKeys = () => setSelectedCourseKeys([]);

  // Filtering Logic: Users
  const filteredUsers = users.filter(u => {
    const matchesSearch = (
      (u.name || '').toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.fullName || '').toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.mobileNumber || '').toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.telegramUsername || '').toLowerCase().includes(userSearch.toLowerCase())
    );

    // Empty selection = no course filter applied (show everyone). Otherwise ANY-match:
    // a user matches if at least one of their resolved course keys is selected.
    const matchesCourseFilter = selectedCourseKeys.length === 0 ||
      getUserCourseKeys(u).some(k => selectedCourseKeys.includes(k));

    return matchesSearch && matchesCourseFilter;
  });

  // Per-course purchase counts (always computed over the full user list, independent of active filters)
  const courseStatsList = [
    ...uniqueCourseIds.map(key => {
      const matchedCourse = courses.find(c => c.courseId.toLowerCase() === key.toLowerCase());
      return {
        key,
        name: matchedCourse ? matchedCourse.name : key,
        subject: matchedCourse ? matchedCourse.subject : 'unmapped course ID',
        count: users.filter(u => (u.interestedCourses || []).some(cid => cid.toLowerCase() === key.toLowerCase())).length
      };
    }),
    { key: '__no_course__', name: 'No Course Purchased', subject: '', count: users.filter(u => (u.interestedCourses || []).length === 0).length }
  ];

  const handleExportPdf = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    doc.setFontSize(14);
    doc.text('User Database Export', 40, 30);
    doc.setFontSize(9);
    doc.text(`Generated ${new Date().toLocaleString()} - ${filteredUsers.length} user(s)`, 40, 46);

    const courseIdToName = new Map(courses.map(c => [c.courseId, c.name]));
    const rows = filteredUsers.map(u => {
      const limits = u.downloadLimits || [];
      const totalDownloaded = limits.reduce((s, d) => s + (d.downloadedCount || 0), 0);
      const totalAllowed = limits.reduce((s, d) => s + (d.allowedCount || 0), 0);
      const courseLabels = (u.interestedCourses || []).map(cid => courseIdToName.get(cid) || cid).join(', ');
      return [
        u.fullName || u.name || '-',
        u.email || '-',
        u.mobileNumber || '-',
        u.telegramUsername ? `@${u.telegramUsername}` : '-',
        u.optionalSubject ? u.optionalSubject.replace('OptionalSubject', '') : '-',
        courseLabels || 'None',
        `${totalDownloaded}/${totalAllowed}`
      ];
    });

    autoTable(doc, {
      startY: 60,
      head: [['Name', 'Email', 'Mobile', 'Telegram', 'Optional Subject', 'Purchased Courses', 'Downloads']],
      body: rows,
      styles: { fontSize: 7, cellPadding: 4 },
      headStyles: { fillColor: [30, 41, 59] },
      columnStyles: {
        0: { cellWidth: 90 }, 1: { cellWidth: 110 }, 2: { cellWidth: 60 },
        3: { cellWidth: 60 }, 4: { cellWidth: 70 }, 5: { cellWidth: 'auto' }, 6: { cellWidth: 50 }
      },
      margin: { left: 40, right: 40 },
      didDrawPage: () => {
        doc.setFontSize(8);
        doc.text(`Page ${doc.internal.getCurrentPageInfo().pageNumber}`, doc.internal.pageSize.getWidth() - 60, doc.internal.pageSize.getHeight() - 20);
      }
    });

    doc.save(`users-export-${Date.now()}.pdf`);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-10 text-text-primary">
      {/* Glow effect headers */}
      <div className="mb-8 border-b border-border-default pb-5 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-xl md:text-3xl font-display font-semibold text-text-primary tracking-tight flex items-center gap-3">
            Admin Database Desk
            <span className="px-2.5 py-0.5 bg-accent-soft-bg border border-accent-soft-border text-brand text-xs font-bold rounded-full uppercase tracking-wider">
              Sheets View
            </span>
          </h1>
          <p className="text-text-secondary text-xs md:text-sm mt-1.5 font-medium">
            Manage transactions with sheet highlights or edit users and their download limits directly from spreadsheet listings.
          </p>
        </div>

        {/* Tab Toggle pill */}
        <div className="flex bg-sunken border border-border-default p-1.5 rounded-2xl w-fit self-start md:self-auto shadow-inner">
          <button
            onClick={() => setCurrentView('transactions')}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              currentView === 'transactions'
                ? 'bg-brand text-text-on-accent shadow'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5"><rect x="2" y="5" width="20" height="14" rx="2" ry="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
            Purchase Transactions
          </button>
          <button
            onClick={() => setCurrentView('users')}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              currentView === 'users'
                ? 'bg-brand text-text-on-accent shadow'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            User Management
          </button>
        </div>
      </div>

      {/* Main View Area */}
      {loading ? (
        <div className="py-24 text-center bg-surface border border-border-default rounded-2xl shadow-sm">
          <LoadingSpinner text={`Retrieving ${currentView === 'transactions' ? 'purchase transactions' : 'user database'}...`} />
        </div>
      ) : error ? (
        <div className="py-16 text-center bg-status-danger-bg border border-status-danger-text/25 rounded-2xl p-6">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-8 h-8 text-rose-500 mx-auto mb-3"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <h3 className="font-bold text-text-primary">Data Load Failure</h3>
          <p className="text-xs text-text-secondary mt-1">{error}</p>
        </div>
      ) : currentView === 'transactions' ? (
        // TRANSACTION VIEW
        <div className="space-y-4">
          {/* Highlight Summary Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-surface border border-border-default rounded-xl p-4 flex flex-col justify-center shadow-sm">
              <span className="text-[10px] text-text-secondary font-bold uppercase tracking-wider">Total Transactions</span>
              <span className="text-2xl font-black text-text-primary mt-1">{transactions.length}</span>
            </div>
            <div className="bg-surface border border-border-default rounded-xl p-4 flex flex-col justify-center shadow-sm">
              <span className="text-[10px] text-text-secondary font-bold uppercase tracking-wider">Unmarked</span>
              <span className="text-2xl font-black text-text-secondary mt-1">{transactions.filter(t => !t.highlight || t.highlight === 'none').length}</span>
            </div>
            <div className="bg-status-danger-bg/40 border border-status-danger-text/20 rounded-xl p-4 flex flex-col justify-center shadow-sm">
              <span className="text-[10px] text-status-danger-text font-bold uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-status-danger-text inline-block"></span>
                Red Highlighted
              </span>
              <span className="text-2xl font-black text-status-danger-text mt-1">{transactions.filter(t => t.highlight === 'red').length}</span>
            </div>
            <div className="bg-status-warning-bg/40 border border-status-warning-text/20 rounded-xl p-4 flex flex-col justify-center shadow-sm">
              <span className="text-[10px] text-status-warning-text font-bold uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-status-warning-text inline-block"></span>
                Yellow Highlighted
              </span>
              <span className="text-2xl font-black text-status-warning-text mt-1">{transactions.filter(t => t.highlight === 'yellow').length}</span>
            </div>
          </div>

          {/* Filters Row */}
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-surface border border-border-default p-4 rounded-2xl shadow-sm">
            <div className="flex flex-wrap gap-2 w-full md:w-auto">
              {['all', 'pending', 'approved', 'rejected'].map((status) => (
                <button
                  key={status}
                  onClick={() => setTxnStatusFilter(status)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer border ${
                    txnStatusFilter === status
                      ? 'bg-accent-soft-bg border-accent-soft-border text-brand'
                      : 'bg-surface border-border-default text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {status} ({transactions.filter(t => status === 'all' ? true : t.status === status).length})
                </button>
              ))}
            </div>
            
            <input
              type="text"
              placeholder="Search UTR, student, email, course..."
              value={txnSearch}
              onChange={(e) => setTxnSearch(e.target.value)}
              className="w-full md:w-80 px-4 py-2 bg-sunken border border-border-default hover:border-border-default/80 focus:border-brand text-text-primary placeholder:text-text-tertiary rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-brand font-medium transition"
            />
          </div>

          {/* Sheet Table */}
          <div className="border border-border-default rounded-2xl overflow-hidden shadow bg-surface">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-sunken border-b border-border-default text-[10px] text-text-secondary uppercase tracking-wider font-bold">
                    <th className="px-4 py-3.5">Timestamp</th>
                    <th className="px-4 py-3.5">Student Details</th>
                    <th className="px-4 py-3.5">Purchased Item</th>
                    <th className="px-4 py-3.5 text-right">Amount</th>
                    <th className="px-4 py-3.5">UPI Ref (UTR)</th>
                    <th className="px-4 py-3.5 text-center">Receipt</th>
                    <th className="px-4 py-3.5 text-center">Status</th>
                    <th className="px-4 py-3.5 text-center">Action</th>
                    <th className="px-4 py-3.5 text-center">Marker Highlight</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-default text-xs text-text-primary">
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="px-4 py-12 text-center text-text-tertiary font-semibold">
                        No transactions match the filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((txn) => {
                      // Custom row highlighting styles
                      let rowStyleClass = "hover:bg-sunken/45 transition-all duration-150";
                      if (txn.highlight === 'red') {
                        rowStyleClass = "bg-status-danger-bg border-l-4 border-l-status-danger-text hover:bg-status-danger-bg/90 transition-all duration-150 text-status-danger-text";
                      } else if (txn.highlight === 'yellow') {
                        rowStyleClass = "bg-status-warning-bg border-l-4 border-l-status-warning-text hover:bg-status-warning-bg/90 transition-all duration-150 text-status-warning-text";
                      }

                      return (
                        <tr key={txn._id} className={rowStyleClass}>
                          {/* Time */}
                          <td className="px-4 py-4 whitespace-nowrap text-text-secondary font-medium font-mono text-[10px]">
                            {new Date(txn.createdAt).toLocaleDateString(undefined, {
                              year: 'numeric', month: '2-digit', day: '2-digit'
                            })}
                            <br />
                            {new Date(txn.createdAt).toLocaleTimeString(undefined, {
                              hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
                            })}
                          </td>

                          {/* Student Details */}
                          <td className="px-4 py-4 min-w-[180px]">
                            <div className="font-bold text-text-primary">{txn.userName}</div>
                            <div className="text-[10px] text-text-secondary font-medium font-mono">{txn.userEmail}</div>
                          </td>

                          {/* Purchased Item */}
                          <td className="px-4 py-4 max-w-[200px] truncate">
                            {txn.comboOffer ? (
                              <div>
                                <span className="bg-accent-soft-bg border border-accent-soft-border text-brand font-bold text-[10px] rounded px-1.5 py-0.5 inline-block mb-1">
                                  {txn.comboOffer.label || txn.courseName}
                                </span>
                                <div className="text-[9px] text-text-secondary leading-relaxed font-bold truncate">
                                  {(txn.courses || []).map(c => c.name || c.courseId).join(', ')}
                                </div>
                              </div>
                            ) : (
                              <div>
                                <div className="font-bold text-text-primary">{txn.courseName}</div>
                                <div className="text-[10px] text-brand font-mono font-extrabold uppercase">{txn.courseId}</div>
                              </div>
                            )}
                          </td>

                          {/* Price */}
                          <td className="px-4 py-4 text-right font-extrabold text-text-primary whitespace-nowrap">
                            ₹{txn.price}
                          </td>

                          {/* UPI Txn ID */}
                          <td className="px-4 py-4 font-mono font-bold tracking-wider text-text-secondary">
                            {txn.upiTxnId ? (
                              <div className="flex items-center gap-1.5">
                                <span className="select-all break-all">{txn.upiTxnId}</span>
                                <button
                                  onClick={() => copyToClipboard(txn.upiTxnId)}
                                  className="p-1 bg-surface hover:bg-sunken border border-border-default rounded text-text-secondary hover:text-text-primary transition active:scale-90 cursor-pointer shrink-0"
                                  title="Copy UTR"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-2.5 h-2.5"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                                </button>
                              </div>
                            ) : (
                              <span className="text-text-tertiary font-normal">N/A</span>
                            )}
                          </td>

                          {/* Screenshot */}
                          <td className="px-4 py-4 text-center">
                            <button
                              onClick={() => setLightboxImage(txn.screenshotUrl)}
                              className="p-1 border border-border-default hover:border-brand/40 bg-page rounded-lg overflow-hidden w-12 h-8 inline-flex items-center justify-center cursor-zoom-in transition"
                            >
                              <img
                                src={getImageUrl(txn.screenshotUrl)}
                                alt="Receipt"
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.target.onerror = null;
                                  e.target.src = 'https://placehold.co/100/18181b/a1a1aa?text=No+Img';
                                }}
                              />
                            </button>
                          </td>

                          {/* Status Badge */}
                          <td className="px-4 py-4 text-center whitespace-nowrap">
                            {txn.status === 'pending' ? (
                              <span className="px-2.5 py-0.5 bg-status-warning-bg border border-status-warning-text/20 text-status-warning-text rounded-lg text-[10px] font-black uppercase tracking-wider animate-pulse">
                                Pending
                              </span>
                            ) : txn.status === 'approved' ? (
                              <span className="px-2.5 py-0.5 bg-status-success-bg border border-status-success-text/25 text-status-success-text rounded-lg text-[10px] font-black uppercase tracking-wider">
                                Approved
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 bg-status-danger-bg border border-status-danger-text/25 text-status-danger-text rounded-lg text-[10px] font-black uppercase tracking-wider">
                                Rejected
                              </span>
                            )}
                          </td>

                          {/* Status Admin actions */}
                          <td className="px-4 py-4 text-center whitespace-nowrap">
                            {txn.status === 'pending' ? (
                              <div className="inline-flex gap-1.5">
                                <button
                                  onClick={() => handleTxnStatus(txn._id, 'reject')}
                                  disabled={processingTxnId === txn._id}
                                  className="px-2.5 py-1.5 border border-border-default hover:border-status-danger-text/60 hover:bg-status-danger-bg text-text-secondary hover:text-status-danger-text rounded-lg text-[10px] font-bold transition cursor-pointer"
                                >
                                  Reject
                                </button>
                                <button
                                  onClick={() => handleTxnStatus(txn._id, 'approve')}
                                  disabled={processingTxnId === txn._id}
                                  className="px-2.5 py-1.5 bg-brand hover:bg-brand-hover text-text-on-accent rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
                                >
                                  Approve
                                </button>
                              </div>
                            ) : (
                              <span className="text-[10px] text-text-tertiary font-bold uppercase tracking-wider">Finalized</span>
                            )}
                          </td>

                          {/* Highlights Marker */}
                          <td className="px-4 py-4 text-center whitespace-nowrap">
                            <div className="inline-flex gap-1 bg-sunken border border-border-default p-1 rounded-xl">
                              {/* None (Transparent/Cross) */}
                              <button
                                onClick={() => handleHighlight(txn._id, 'none')}
                                className={`w-4 h-4 rounded-full flex items-center justify-center border transition hover:scale-110 cursor-pointer ${
                                  txn.highlight === 'none' || !txn.highlight
                                    ? 'border-text-secondary bg-surface text-text-secondary font-bold'
                                    : 'border-transparent bg-transparent text-transparent'
                                }`}
                                title="No Highlight"
                              >
                                <span className="text-[7px] font-black">×</span>
                              </button>
                              {/* Red highlight */}
                              <button
                                onClick={() => handleHighlight(txn._id, 'red')}
                                className={`w-4 h-4 rounded-full border transition hover:scale-110 cursor-pointer bg-status-danger-text ${
                                  txn.highlight === 'red' ? 'border-text-primary scale-105' : 'border-transparent'
                                }`}
                                title="Highlight Red"
                              />
                              {/* Yellow highlight */}
                              <button
                                onClick={() => handleHighlight(txn._id, 'yellow')}
                                className={`w-4 h-4 rounded-full border transition hover:scale-110 cursor-pointer bg-status-warning-text ${
                                  txn.highlight === 'yellow' ? 'border-text-primary scale-105' : 'border-transparent'
                                }`}
                                title="Highlight Yellow"
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        // USER DATABASE VIEW
        <div className="space-y-4">
          {/* Per-course purchase stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {courseStatsList.map((c) => (
              <div key={c.key} className="bg-surface border border-border-default rounded-xl p-3 flex flex-col justify-center shadow-sm">
                <span className="text-[10px] text-text-secondary font-bold uppercase tracking-wider truncate" title={c.subject ? `${c.name} (${c.subject})` : c.name}>{c.name}</span>
                <span className="text-lg font-black text-text-primary mt-1">{c.count}</span>
              </div>
            ))}
          </div>

          {/* Advanced course filter: multi-select with Others/No-Course buckets + quick display modes */}
          <div className="bg-surface border border-border-default p-4 rounded-2xl space-y-3 shadow-sm">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">
                Course Filter {selectedCourseKeys.length > 0 && <span className="text-brand">({selectedCourseKeys.length} selected)</span>}
              </span>
              <div className="flex gap-2">
                <button onClick={clearCourseKeys} className="px-2.5 py-1 bg-sunken hover:bg-border-default/40 text-text-secondary rounded-lg text-[10px] font-bold cursor-pointer transition animate-none">Display All</button>
                <button onClick={selectAllCourseKeys} className="px-2.5 py-1 bg-sunken hover:bg-border-default/40 text-text-secondary rounded-lg text-[10px] font-bold cursor-pointer transition animate-none">Select All</button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-[180px] overflow-y-auto bg-sunken border border-border-subtle rounded-xl p-3">
              {courseStatsList.map((c) => {
                const checked = selectedCourseKeys.includes(c.key);
                return (
                  <button
                    type="button"
                    key={c.key}
                    onClick={() => toggleCourseKey(c.key)}
                    className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-left text-[11px] font-semibold transition cursor-pointer ${
                      checked ? 'bg-accent-soft-bg border-brand text-brand' : 'bg-surface border-border-default text-text-secondary hover:border-border-default/80'
                    }`}
                  >
                    <span className="truncate">{c.name} <span className="text-text-tertiary font-normal">({c.count})</span></span>
                    <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${checked ? 'bg-brand border-brand' : 'border-border-default bg-surface'}`}>
                      {checked && <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" className="w-2.5 h-2.5 text-text-on-accent"><polyline points="20 6 9 17 4 12"/></svg>}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* User Search & Meta Row */}
          <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-surface border border-border-default p-4 rounded-2xl shadow-sm">
            <div className="text-xs font-bold text-text-secondary whitespace-nowrap">
              Showing <span className="text-text-primary font-bold">{filteredUsers.length}</span> user profile(s)
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 w-full md:w-auto">
              <input
                type="text"
                placeholder="Search user email, full name, mobile, telegram..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="w-full md:w-72 px-4 py-2 bg-sunken border border-border-default hover:border-border-default/80 focus:border-brand text-text-primary placeholder:text-text-tertiary rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-brand font-medium transition"
              />

              <button
                onClick={handleExportPdf}
                className="px-4 py-2 bg-brand hover:bg-brand-hover text-text-on-accent rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap shadow-sm"
              >
                Download as PDF
              </button>
            </div>
          </div>

          {/* User Database Sheet Table */}
          <div className="border border-border-default rounded-2xl overflow-hidden shadow bg-surface">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-sunken border-b border-border-default text-[10px] text-text-secondary uppercase tracking-wider font-bold">
                    <th className="px-4 py-3.5 text-center">User</th>
                    <th className="px-4 py-3.5">Authentication Details</th>
                    <th className="px-4 py-3.5">Contact Numbers</th>
                    <th className="px-4 py-3.5">Optional Prep Subject</th>
                    <th className="px-4 py-3.5">Subscribed Course IDs</th>
                    <th className="px-4 py-3.5 text-center">Downloads Status</th>
                    <th className="px-4 py-3.5 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-default text-xs text-text-primary">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="px-4 py-12 text-center text-text-tertiary font-semibold">
                        No registered users found matching search query.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => {
                      const limits = user.downloadLimits || [];
                      const totalDownloaded = limits.reduce((sum, d) => sum + (d.downloadedCount || 0), 0);
                      const totalAllowed = limits.reduce((sum, d) => sum + (d.allowedCount || 0), 0);

                      return (
                        <tr key={user._id} className="hover:bg-sunken/45 transition duration-150">
                          {/* Profile picture */}
                          <td className="px-4 py-4 text-center whitespace-nowrap">
                            <img
                              src={user.picture || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.name || 'User')}`}
                              alt={user.name}
                              className="w-8 h-8 rounded-full border border-border-default mx-auto object-cover"
                            />
                          </td>

                          {/* Auth Details */}
                          <td className="px-4 py-4 min-w-[200px]">
                            <div className="font-bold text-text-primary">{user.fullName || user.name}</div>
                            <div className="text-[10px] text-text-secondary font-medium font-mono">{user.email}</div>
                            <div className="text-[9px] text-text-tertiary font-mono mt-0.5">Google ID: {user.googleId}</div>
                          </td>

                          {/* Contact numbers */}
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="font-semibold text-text-secondary">
                              📞 {user.mobileNumber || <span className="text-text-tertiary italic font-normal">No number</span>}
                            </div>
                            <div className="text-[10px] text-text-secondary mt-0.5">
                              ✈️ @{user.telegramUsername || <span className="text-text-tertiary italic">No account</span>}
                            </div>
                          </td>

                          {/* Optional Subject */}
                          <td className="px-4 py-4">
                            {user.optionalSubject ? (
                              <span className="bg-sunken border border-border-subtle px-2 py-0.5 rounded text-[10px] font-bold text-brand">
                                {user.optionalSubject.replace('OptionalSubject', '')}
                              </span>
                            ) : (
                              <span className="text-text-tertiary italic">Unspecified</span>
                            )}
                          </td>

                          {/* Subscribed Courses */}
                          <td className="px-4 py-4 max-w-[250px]">
                            <div className="flex flex-wrap gap-1">
                              {(user.interestedCourses || []).length === 0 ? (
                                <span className="text-text-tertiary italic text-[10px]">None</span>
                              ) : (
                                (user.interestedCourses || []).map((cid) => (
                                  <span key={cid} className="bg-accent-soft-bg border border-accent-soft-border text-brand rounded px-1.5 py-0.5 text-[9px] font-bold uppercase">
                                    {cid}
                                  </span>
                                ))
                              )}
                            </div>
                          </td>

                          {/* Download Status */}
                          <td className="px-4 py-4 text-center whitespace-nowrap font-mono font-bold text-text-secondary">
                            {totalDownloaded} / {totalAllowed} files
                          </td>

                          {/* Edit Actions */}
                          <td className="px-4 py-4 text-center whitespace-nowrap">
                            <button
                              onClick={() => setEditingUser(JSON.parse(JSON.stringify(user)))} // deep clone to edit safely
                              className="px-3.5 py-1.5 bg-surface border border-border-default hover:bg-sunken text-brand rounded-lg text-[10px] font-bold transition cursor-pointer"
                            >
                              Edit Profile
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Receipt Image Zoom */}
      {lightboxImage && (
        <div 
          className="fixed inset-0 z-[150] bg-ink-950/95 flex flex-col items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <button 
            onClick={() => setLightboxImage(null)}
            className="absolute top-4 right-4 text-text-secondary hover:text-text-primary p-2 bg-surface/85 border border-border-default rounded-full hover:bg-sunken transition cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
          
          <img 
            src={getImageUrl(lightboxImage)} 
            alt="Receipt Zoomed" 
            className="max-w-full max-h-[85vh] object-contain rounded-lg border border-border-default shadow-2xl scale-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = 'https://placehold.co/600x400/18181b/a1a1aa?text=Image+Unavailable';
            }}
          />
          <div className="text-text-secondary text-xs mt-4 font-bold uppercase tracking-wider select-none bg-surface/65 border border-border-default px-3 py-1.5 rounded-xl">
            Click outside image to close
          </div>
        </div>
      )}

      {/* EDIT USER DETAILS MODAL (Spreadsheet Detail Editor) */}
      {editingUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink-950/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-surface border border-border-default rounded-2xl w-full max-w-2xl p-5 md:p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200 my-auto max-h-[90vh] overflow-y-auto text-text-primary">
            {/* Header */}
            <div className="flex justify-between items-start mb-6 pb-4 border-b border-border-default">
              <div className="flex items-center gap-3">
                <img
                  src={editingUser.picture || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(editingUser.name || 'User')}`}
                  alt={editingUser.name}
                  className="w-10 h-10 rounded-full border border-border-default object-cover"
                />
                <div>
                  <h3 className="text-sm md:text-base font-bold text-text-primary">
                    Modify Profile: {editingUser.fullName || editingUser.name}
                  </h3>
                  <p className="text-[10px] text-text-secondary font-mono font-medium">{editingUser.email}</p>
                </div>
              </div>
              
              <button
                onClick={() => setEditingUser(null)}
                className="text-text-secondary hover:text-text-primary p-1.5 hover:bg-sunken rounded-xl transition cursor-pointer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            {/* Editor Grid Form */}
            <div className="space-y-5">
              {/* Row 1: Personal info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider block">First / System Name</label>
                  <input
                    type="text"
                    value={editingUser.name || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                    className="w-full bg-sunken border border-border-default focus:border-brand text-text-primary rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand transition font-medium"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider block">Full Name</label>
                  <input
                    type="text"
                    value={editingUser.fullName || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, fullName: e.target.value })}
                    className="w-full bg-sunken border border-border-default focus:border-brand text-text-primary rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand transition font-medium"
                  />
                </div>
              </div>

              {/* Row 2: email and optional */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider block">Registered Email Address</label>
                  <input
                    type="email"
                    value={editingUser.email || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                    className="w-full bg-sunken border border-border-default focus:border-brand text-text-primary rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand transition font-medium"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider block">Optional Subject</label>
                  <select
                    value={editingUser.optionalSubject || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, optionalSubject: e.target.value || null })}
                    className="w-full bg-sunken border border-border-default focus:border-brand text-text-primary rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand transition font-medium"
                  >
                    <option value="">-- No Optional Chosen --</option>
                    <option value="OptionalSubjectSociology">Sociology</option>
                    <option value="OptionalSubjectAnthropology">Anthropology</option>
                    <option value="OptionalSubjectGeography">Geography</option>
                    <option value="OptionalSubjectHistory">History</option>
                    <option value="OptionalSubjectPublicAdministration">Public Administration</option>
                    <option value="OptionalSubjectPoliticalScienceAndInternationalRelations">PSIR</option>
                  </select>
                </div>
              </div>

              {/* Row 3: Contacts */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider block">Mobile Number (Verified)</label>
                  <input
                    type="text"
                    value={editingUser.mobileNumber || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, mobileNumber: e.target.value })}
                    className="w-full bg-sunken border border-border-default focus:border-brand text-text-primary rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand transition font-medium"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider block">Telegram Username (@)</label>
                  <input
                    type="text"
                    value={editingUser.telegramUsername || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, telegramUsername: e.target.value.replace(/^@/, '') })}
                    className="w-full bg-sunken border border-border-default focus:border-brand text-text-primary rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand transition font-medium"
                  />
                </div>
              </div>

              {/* Course Subscriptions (Checkboxes Grid) */}
              <div className="space-y-2.5">
                <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider block">Interested / Subscribed Courses</label>
                <div className="bg-sunken border border-border-subtle rounded-xl p-3.5 grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[160px] overflow-y-auto">
                  {courses.map((course) => {
                    const isChecked = (editingUser.interestedCourses || []).includes(course.courseId);
                    return (
                      <button
                        type="button"
                        key={course.courseId}
                        onClick={() => {
                          const current = [...(editingUser.interestedCourses || [])];
                          if (current.includes(course.courseId)) {
                            // remove
                            setEditingUser({
                              ...editingUser,
                              interestedCourses: current.filter(cid => cid !== course.courseId)
                            });
                          } else {
                            // add
                            setEditingUser({
                              ...editingUser,
                              interestedCourses: [...current, course.courseId]
                            });
                          }
                        }}
                        className={`flex items-center justify-between text-left px-3 py-2 rounded-lg border text-[11px] transition cursor-pointer ${
                          isChecked
                            ? 'bg-accent-soft-bg border-brand text-brand font-semibold'
                            : 'bg-surface border-border-default text-text-secondary hover:border-border-default/80'
                        }`}
                      >
                        <span className="font-semibold truncate pr-2">{course.name || course.courseId}</span>
                        <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                          isChecked ? 'bg-brand border-brand text-text-on-accent' : 'border-border-default bg-surface'
                        }`}>
                          {isChecked && <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" className="w-2.5 h-2.5"><polyline points="20 6 9 17 4 12"/></svg>}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* PDF Download Limit Overrides */}
              <div className="space-y-2.5">
                <label className="text-[10px] font-bold text-text-secondary uppercase tracking-wider block">Custom Download Limits Overrides</label>
                <div className="bg-sunken border border-border-subtle rounded-xl p-3.5 space-y-2.5 max-h-[200px] overflow-y-auto">
                  {(editingUser.downloadLimits || []).length === 0 ? (
                    <div className="text-center py-4 text-text-tertiary font-medium italic">
                      No course download limit initialized for this user yet. 
                      <br />
                      Limits auto-initialize on course purchase approvals.
                    </div>
                  ) : (
                    (editingUser.downloadLimits || []).map((limit, index) => (
                      <div key={index} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2.5 bg-surface border border-border-default rounded-lg">
                        <div className="font-bold text-text-secondary text-[11px] uppercase truncate shrink-0 max-w-[200px]">
                          📄 {limit.courseId}
                        </div>
                        <div className="flex items-center gap-3.5 shrink-0 self-end sm:self-auto">
                          {/* Download count */}
                          <div className="flex items-center gap-1.5 text-[10px]">
                            <span className="text-text-secondary font-semibold">Downloaded:</span>
                            <input
                              type="number"
                              min="0"
                              value={limit.downloadedCount}
                              onChange={(e) => {
                                const newLimits = [...(editingUser.downloadLimits || [])];
                                newLimits[index] = { ...limit, downloadedCount: parseInt(e.target.value) || 0 };
                                setEditingUser({ ...editingUser, downloadLimits: newLimits });
                              }}
                              className="w-12 bg-sunken border border-border-default text-text-primary px-1.5 py-0.5 rounded text-center font-mono font-bold"
                            />
                          </div>

                          {/* Allowed count */}
                          <div className="flex items-center gap-1.5 text-[10px]">
                            <span className="text-text-secondary font-semibold">Allowed Max:</span>
                            <input
                              type="number"
                              min="1"
                              value={limit.allowedCount}
                              onChange={(e) => {
                                const newLimits = [...(editingUser.downloadLimits || [])];
                                newLimits[index] = { ...limit, allowedCount: parseInt(e.target.value) || 1 };
                                setEditingUser({ ...editingUser, downloadLimits: newLimits });
                              }}
                              className="w-12 bg-sunken border border-border-default text-text-primary px-1.5 py-0.5 rounded text-center font-mono font-bold"
                            />
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Footer buttons */}
            <div className="flex items-center justify-end gap-3 pt-5 mt-6 border-t border-border-default">
              <button
                onClick={() => setEditingUser(null)}
                className="px-4 py-2 border border-border-default hover:bg-sunken text-text-secondary hover:text-text-primary text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleSaveUser(editingUser._id, {
                  name: editingUser.name,
                  fullName: editingUser.fullName,
                  email: editingUser.email,
                  mobileNumber: editingUser.mobileNumber,
                  telegramUsername: editingUser.telegramUsername,
                  optionalSubject: editingUser.optionalSubject,
                  interestedCourses: editingUser.interestedCourses,
                  downloadLimits: editingUser.downloadLimits
                })}
                className="px-6 py-2 bg-brand hover:bg-brand-hover text-text-on-accent rounded-xl text-xs font-bold transition shadow cursor-pointer font-semibold"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
