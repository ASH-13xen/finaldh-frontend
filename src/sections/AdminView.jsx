import { useState, useEffect } from 'react';
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

  // Helper: zoom screenshot image
  const getImageUrl = (path) => {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    const apiBaseUrl = import.meta.env.VITE_API_URL || '';
    return `${apiBaseUrl.replace(/\/$/, '')}${path}`;
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

  // Filtering Logic: Users
  const filteredUsers = users.filter(u => {
    return (
      (u.name || '').toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.fullName || '').toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.mobileNumber || '').toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.telegramUsername || '').toLowerCase().includes(userSearch.toLowerCase())
    );
  });

  return (
    <div className="w-full max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-10">
      {/* Glow effect headers */}
      <div className="mb-8 border-b border-slate-800 pb-5 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            Admin Database Desk
            <span className="px-2.5 py-0.5 bg-accent-500/10 border border-accent-500/20 text-accent-400 text-xs font-black rounded-full uppercase tracking-wider">
              Sheets View
            </span>
          </h1>
          <p className="text-slate-400 text-xs md:text-sm mt-1.5 font-medium">
            Manage transactions with sheet highlights or edit users and their download limits directly from spreadsheet listings.
          </p>
        </div>

        {/* Tab Toggle pill */}
        <div className="flex bg-slate-900 border border-slate-800 p-1.5 rounded-2xl w-fit self-start md:self-auto shadow-inner">
          <button
            onClick={() => setCurrentView('transactions')}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              currentView === 'transactions'
                ? 'bg-accent-600 text-white shadow-md shadow-accent-950/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5"><rect x="2" y="5" width="20" height="14" rx="2" ry="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
            Purchase Transactions
          </button>
          <button
            onClick={() => setCurrentView('users')}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              currentView === 'users'
                ? 'bg-accent-600 text-white shadow-md shadow-accent-950/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            User Management
          </button>
        </div>
      </div>

      {/* Main View Area */}
      {loading ? (
        <div className="py-24 text-center bg-slate-900/20 border border-slate-800/80 rounded-2xl">
          <LoadingSpinner text={`Retrieving ${currentView === 'transactions' ? 'purchase transactions' : 'user database'}...`} />
        </div>
      ) : error ? (
        <div className="py-16 text-center bg-rose-950/20 border border-rose-900/50 rounded-2xl p-6">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-8 h-8 text-rose-500 mx-auto mb-3"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <h3 className="font-bold text-white">Data Load Failure</h3>
          <p className="text-xs text-slate-400 mt-1">{error}</p>
        </div>
      ) : currentView === 'transactions' ? (
        // TRANSACTION VIEW
        <div className="space-y-4">
          {/* Filters Row */}
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-900/40 border border-slate-800 p-4 rounded-2xl">
            <div className="flex flex-wrap gap-2.5 w-full md:w-auto">
              {['all', 'pending', 'approved', 'rejected'].map((status) => (
                <button
                  key={status}
                  onClick={() => setTxnStatusFilter(status)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    txnStatusFilter === status
                      ? 'bg-accent-950/50 border border-accent-700 text-accent-300'
                      : 'bg-slate-950 border border-slate-850 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {status} ({transactions.filter(t => status === 'all' ? true : t.status === status).length})
                </button>
              ))}
            </div>
            
            <input
              type="text"
              placeholder="Search ref UTR, student, email, course..."
              value={txnSearch}
              onChange={(e) => setTxnSearch(e.target.value)}
              className="w-full md:w-80 px-4 py-2 bg-slate-950 border border-slate-850 hover:border-slate-750 focus:border-accent-500 text-slate-200 placeholder:text-slate-650 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-accent-500 font-medium"
            />
          </div>

          {/* Sheet Table */}
          <div className="border border-slate-800 rounded-2xl overflow-hidden shadow-xl bg-slate-900/20 backdrop-blur-md">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900/80 border-b border-slate-800 text-[10px] text-slate-400 uppercase tracking-wider font-extrabold">
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
                <tbody className="divide-y divide-slate-850 text-xs">
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="px-4 py-12 text-center text-slate-500 font-semibold">
                        No transactions match the filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((txn) => {
                      // Custom row highlighting styles
                      let rowStyleClass = "hover:bg-slate-850/30 transition-all duration-150";
                      if (txn.highlight === 'red') {
                        rowStyleClass = "bg-rose-950/20 border-l-4 border-l-rose-500 hover:bg-rose-950/30 transition-all duration-150";
                      } else if (txn.highlight === 'yellow') {
                        rowStyleClass = "bg-amber-950/15 border-l-4 border-l-amber-500 hover:bg-amber-950/20 transition-all duration-150";
                      }

                      return (
                        <tr key={txn._id} className={rowStyleClass}>
                          {/* Time */}
                          <td className="px-4 py-4 whitespace-nowrap text-slate-450 font-medium font-mono text-[10px]">
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
                            <div className="font-bold text-slate-100">{txn.userName}</div>
                            <div className="text-[10px] text-slate-450 font-medium font-mono">{txn.userEmail}</div>
                          </td>

                          {/* Purchased Item */}
                          <td className="px-4 py-4 max-w-[200px] truncate">
                            {txn.comboOffer ? (
                              <div>
                                <span className="bg-accent-950/50 border border-accent-900/60 text-accent-400 font-extrabold text-[10px] rounded px-1.5 py-0.5 inline-block mb-1">
                                  {txn.comboOffer.label || txn.courseName}
                                </span>
                                <div className="text-[9px] text-slate-450 leading-relaxed font-bold truncate">
                                  {(txn.courses || []).map(c => c.name || c.courseId).join(', ')}
                                </div>
                              </div>
                            ) : (
                              <div>
                                <div className="font-bold text-slate-200">{txn.courseName}</div>
                                <div className="text-[10px] text-accent-400 font-mono font-extrabold uppercase">{txn.courseId}</div>
                              </div>
                            )}
                          </td>

                          {/* Price */}
                          <td className="px-4 py-4 text-right font-extrabold text-slate-200 whitespace-nowrap">
                            ₹{txn.price}
                          </td>

                          {/* UPI Txn ID */}
                          <td className="px-4 py-4 font-mono font-bold tracking-wider text-slate-300">
                            {txn.upiTxnId ? (
                              <div className="flex items-center gap-1.5">
                                <span className="select-all">{txn.upiTxnId}</span>
                                <button
                                  onClick={() => copyToClipboard(txn.upiTxnId)}
                                  className="p-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded text-slate-500 hover:text-white transition active:scale-90 cursor-pointer"
                                  title="Copy UTR"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-2.5 h-2.5"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                                </button>
                              </div>
                            ) : (
                              <span className="text-slate-600 font-normal">N/A</span>
                            )}
                          </td>

                          {/* Screenshot */}
                          <td className="px-4 py-4 text-center">
                            <button
                              onClick={() => setLightboxImage(txn.screenshotUrl)}
                              className="p-1 border border-slate-800 hover:border-accent-500/50 bg-slate-950 rounded-lg overflow-hidden w-12 h-8 inline-flex items-center justify-center cursor-zoom-in transition"
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
                              <span className="px-2.5 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-lg text-[10px] font-black uppercase tracking-wider animate-pulse">
                                Pending
                              </span>
                            ) : txn.status === 'approved' ? (
                              <span className="px-2.5 py-0.5 bg-emerald-500/10 border border-emerald-500/25 text-emerald-450 rounded-lg text-[10px] font-black uppercase tracking-wider">
                                Approved
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 bg-rose-500/10 border border-rose-500/25 text-rose-450 rounded-lg text-[10px] font-black uppercase tracking-wider">
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
                                  className="px-2.5 py-1.5 border border-slate-800 hover:border-rose-900/60 hover:bg-rose-950/10 text-slate-400 hover:text-rose-500 rounded-lg text-[10px] font-bold transition cursor-pointer"
                                >
                                  Reject
                                </button>
                                <button
                                  onClick={() => handleTxnStatus(txn._id, 'approve')}
                                  disabled={processingTxnId === txn._id}
                                  className="px-2.5 py-1.5 bg-accent-650 hover:bg-accent-500 text-white rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
                                >
                                  Approve
                                </button>
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-550 font-bold uppercase tracking-wider">Finalized</span>
                            )}
                          </td>

                          {/* Highlights Marker */}
                          <td className="px-4 py-4 text-center whitespace-nowrap">
                            <div className="inline-flex gap-1 bg-slate-950 border border-slate-850 p-1 rounded-xl">
                              {/* None (Transparent/Cross) */}
                              <button
                                onClick={() => handleHighlight(txn._id, 'none')}
                                className={`w-4 h-4 rounded-full flex items-center justify-center border transition hover:scale-110 cursor-pointer ${
                                  txn.highlight === 'none' || !txn.highlight
                                    ? 'border-slate-500 bg-slate-900 text-slate-400'
                                    : 'border-transparent bg-transparent text-transparent'
                                }`}
                                title="No Highlight"
                              >
                                <span className="text-[7px] font-black">×</span>
                              </button>
                              {/* Red highlight */}
                              <button
                                onClick={() => handleHighlight(txn._id, 'red')}
                                className={`w-4 h-4 rounded-full border transition hover:scale-110 cursor-pointer bg-red-650 ${
                                  txn.highlight === 'red' ? 'border-white scale-105' : 'border-transparent'
                                }`}
                                title="Highlight Red"
                              />
                              {/* Yellow highlight */}
                              <button
                                onClick={() => handleHighlight(txn._id, 'yellow')}
                                className={`w-4 h-4 rounded-full border transition hover:scale-110 cursor-pointer bg-yellow-550 ${
                                  txn.highlight === 'yellow' ? 'border-white scale-105' : 'border-transparent'
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
          {/* User Search & Meta Row */}
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-900/40 border border-slate-800 p-4 rounded-2xl">
            <div className="text-xs font-bold text-slate-350">
              Showing <span className="text-white">{filteredUsers.length}</span> user profiles registered in database
            </div>
            
            <input
              type="text"
              placeholder="Search user email, full name, mobile, telegram..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              className="w-full md:w-80 px-4 py-2 bg-slate-950 border border-slate-850 hover:border-slate-750 focus:border-accent-500 text-slate-200 placeholder:text-slate-650 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-accent-500 font-medium"
            />
          </div>

          {/* User Database Sheet Table */}
          <div className="border border-slate-800 rounded-2xl overflow-hidden shadow-xl bg-slate-900/20 backdrop-blur-md">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900/80 border-b border-slate-800 text-[10px] text-slate-400 uppercase tracking-wider font-extrabold">
                    <th className="px-4 py-3.5 text-center">User</th>
                    <th className="px-4 py-3.5">Authentication Details</th>
                    <th className="px-4 py-3.5">Contact Numbers</th>
                    <th className="px-4 py-3.5">Optional Prep Subject</th>
                    <th className="px-4 py-3.5">Subscribed Course IDs</th>
                    <th className="px-4 py-3.5 text-center">Downloads Status</th>
                    <th className="px-4 py-3.5 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850 text-xs">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="px-4 py-12 text-center text-slate-500 font-semibold">
                        No registered users found matching search query.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => {
                      const limits = user.downloadLimits || [];
                      const totalDownloaded = limits.reduce((sum, d) => sum + (d.downloadedCount || 0), 0);
                      const totalAllowed = limits.reduce((sum, d) => sum + (d.allowedCount || 0), 0);

                      return (
                        <tr key={user._id} className="hover:bg-slate-850/30 transition duration-150">
                          {/* Profile picture */}
                          <td className="px-4 py-4 text-center whitespace-nowrap">
                            <img
                              src={user.picture || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.name || 'User')}`}
                              alt={user.name}
                              className="w-8 h-8 rounded-full border border-slate-800 mx-auto object-cover"
                            />
                          </td>

                          {/* Auth Details */}
                          <td className="px-4 py-4 min-w-[200px]">
                            <div className="font-bold text-slate-200">{user.fullName || user.name}</div>
                            <div className="text-[10px] text-slate-450 font-medium font-mono">{user.email}</div>
                            <div className="text-[9px] text-slate-600 font-mono mt-0.5">Google ID: {user.googleId}</div>
                          </td>

                          {/* Contact numbers */}
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="font-semibold text-slate-350">
                              📞 {user.mobileNumber || <span className="text-slate-650 italic font-normal">No number</span>}
                            </div>
                            <div className="text-[10px] text-slate-450 mt-0.5">
                              ✈️ @{user.telegramUsername || <span className="text-slate-650 italic">No account</span>}
                            </div>
                          </td>

                          {/* Optional Subject */}
                          <td className="px-4 py-4">
                            {user.optionalSubject ? (
                              <span className="bg-slate-950/60 border border-slate-850 px-2 py-0.5 rounded text-[10px] font-bold text-accent-400">
                                {user.optionalSubject.replace('OptionalSubject', '')}
                              </span>
                            ) : (
                              <span className="text-slate-600 italic">Unspecified</span>
                            )}
                          </td>

                          {/* Subscribed Courses */}
                          <td className="px-4 py-4 max-w-[250px]">
                            <div className="flex flex-wrap gap-1">
                              {(user.interestedCourses || []).length === 0 ? (
                                <span className="text-slate-600 italic text-[10px]">None</span>
                              ) : (
                                (user.interestedCourses || []).map((cid) => (
                                  <span key={cid} className="bg-emerald-950/30 border border-emerald-900/40 text-emerald-450 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase">
                                    {cid}
                                  </span>
                                ))
                              )}
                            </div>
                          </td>

                          {/* Download Status */}
                          <td className="px-4 py-4 text-center whitespace-nowrap font-mono font-bold text-slate-350">
                            {totalDownloaded} / {totalAllowed} files
                          </td>

                          {/* Edit Actions */}
                          <td className="px-4 py-4 text-center whitespace-nowrap">
                            <button
                              onClick={() => setEditingUser(JSON.parse(JSON.stringify(user)))} // deep clone to edit safely
                              className="px-3.5 py-1.5 bg-slate-950 border border-slate-800 hover:border-slate-700 text-accent-400 hover:text-accent-300 rounded-lg text-[10px] font-black transition cursor-pointer"
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
          className="fixed inset-0 z-[150] bg-slate-950/95 flex flex-col items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <button 
            onClick={() => setLightboxImage(null)}
            className="absolute top-4 right-4 text-slate-300 hover:text-white p-2 bg-slate-900/80 border border-slate-800 rounded-full hover:bg-slate-800 transition"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
          
          <img 
            src={getImageUrl(lightboxImage)} 
            alt="Receipt Zoomed" 
            className="max-w-full max-h-[85vh] object-contain rounded-lg border border-slate-850 shadow-2xl scale-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = 'https://placehold.co/600x400/18181b/a1a1aa?text=Image+Unavailable';
            }}
          />
          <div className="text-slate-400 text-xs mt-4 font-bold uppercase tracking-wider select-none bg-slate-900/60 border border-slate-800 px-3 py-1.5 rounded-xl">
            Click outside image to close
          </div>
        </div>
      )}

      {/* EDIT USER DETAILS MODAL (Spreadsheet Detail Editor) */}
      {editingUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl p-5 md:p-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200 my-auto max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex justify-between items-start mb-6 pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <img
                  src={editingUser.picture || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(editingUser.name || 'User')}`}
                  alt={editingUser.name}
                  className="w-10 h-10 rounded-full border border-slate-800 object-cover"
                />
                <div>
                  <h3 className="text-sm md:text-base font-extrabold text-white">
                    Modify Profile: {editingUser.fullName || editingUser.name}
                  </h3>
                  <p className="text-[10px] text-slate-450 font-mono font-medium">{editingUser.email}</p>
                </div>
              </div>
              
              <button
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-white p-1.5 hover:bg-slate-800 rounded-xl transition cursor-pointer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            {/* Editor Grid Form */}
            <div className="space-y-5">
              {/* Row 1: Personal info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">First / System Name</label>
                  <input
                    type="text"
                    value={editingUser.name || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-850 focus:border-accent-500 text-slate-100 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-accent-500 transition font-medium"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Full Name</label>
                  <input
                    type="text"
                    value={editingUser.fullName || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, fullName: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-850 focus:border-accent-500 text-slate-100 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-accent-500 transition font-medium"
                  />
                </div>
              </div>

              {/* Row 2: email and optional */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Registered Email Address</label>
                  <input
                    type="email"
                    value={editingUser.email || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-850 focus:border-accent-500 text-slate-100 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-accent-500 transition font-medium"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Optional Subject</label>
                  <select
                    value={editingUser.optionalSubject || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, optionalSubject: e.target.value || null })}
                    className="w-full bg-slate-950 border border-slate-850 focus:border-accent-500 text-slate-150 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-accent-500 transition font-medium"
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
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Mobile Number (Verified)</label>
                  <input
                    type="text"
                    value={editingUser.mobileNumber || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, mobileNumber: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-850 focus:border-accent-500 text-slate-100 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-accent-500 transition font-medium"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Telegram Username (@)</label>
                  <input
                    type="text"
                    value={editingUser.telegramUsername || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, telegramUsername: e.target.value.replace(/^@/, '') })}
                    className="w-full bg-slate-950 border border-slate-850 focus:border-accent-500 text-slate-100 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-accent-500 transition font-medium"
                  />
                </div>
              </div>

              {/* Course Subscriptions (Checkboxes Grid) */}
              <div className="space-y-2.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Interested / Subscribed Courses</label>
                <div className="bg-slate-950 border border-slate-850 rounded-xl p-3.5 grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[160px] overflow-y-auto">
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
                        className={`flex items-center justify-between text-left px-3 py-2 rounded-lg border text-[11px] transition ${
                          isChecked
                            ? 'bg-accent-950/20 border-accent-600 text-accent-200'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-750'
                        }`}
                      >
                        <span className="font-semibold truncate pr-2">{course.name || course.courseId}</span>
                        <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                          isChecked ? 'bg-accent-600 border-accent-550 text-white' : 'border-slate-700'
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
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Custom Download Limits Overrides</label>
                <div className="bg-slate-950 border border-slate-850 rounded-xl p-3.5 space-y-2.5 max-h-[200px] overflow-y-auto">
                  {(editingUser.downloadLimits || []).length === 0 ? (
                    <div className="text-center py-4 text-slate-550 font-medium italic">
                      No course download limit initialized for this user yet. 
                      <br />
                      Limits auto-initialize on course purchase approvals.
                    </div>
                  ) : (
                    (editingUser.downloadLimits || []).map((limit, index) => (
                      <div key={index} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2.5 bg-slate-900/60 border border-slate-850 rounded-lg">
                        <div className="font-bold text-slate-350 text-[11px] uppercase truncate shrink-0 max-w-[200px]">
                          📄 {limit.courseId}
                        </div>
                        <div className="flex items-center gap-3.5 shrink-0 self-end sm:self-auto">
                          {/* Download count */}
                          <div className="flex items-center gap-1.5 text-[10px]">
                            <span className="text-slate-450 font-semibold">Downloaded:</span>
                            <input
                              type="number"
                              min="0"
                              value={limit.downloadedCount}
                              onChange={(e) => {
                                const newLimits = [...(editingUser.downloadLimits || [])];
                                newLimits[index] = { ...limit, downloadedCount: parseInt(e.target.value) || 0 };
                                setEditingUser({ ...editingUser, downloadLimits: newLimits });
                              }}
                              className="w-12 bg-slate-950 border border-slate-800 text-slate-200 px-1.5 py-0.5 rounded text-center font-mono font-bold"
                            />
                          </div>

                          {/* Allowed count */}
                          <div className="flex items-center gap-1.5 text-[10px]">
                            <span className="text-slate-450 font-semibold">Allowed Max:</span>
                            <input
                              type="number"
                              min="1"
                              value={limit.allowedCount}
                              onChange={(e) => {
                                const newLimits = [...(editingUser.downloadLimits || [])];
                                newLimits[index] = { ...limit, allowedCount: parseInt(e.target.value) || 1 };
                                setEditingUser({ ...editingUser, downloadLimits: newLimits });
                              }}
                              className="w-12 bg-slate-950 border border-slate-800 text-slate-200 px-1.5 py-0.5 rounded text-center font-mono font-bold"
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
            <div className="flex items-center justify-end gap-3 pt-5 mt-6 border-t border-slate-800">
              <button
                onClick={() => setEditingUser(null)}
                className="px-4 py-2 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white text-xs font-bold rounded-xl transition cursor-pointer"
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
                className="px-6 py-2 bg-accent-600 hover:bg-accent-500 text-white rounded-xl text-xs font-bold transition shadow-md hover:shadow-accent-950/20 cursor-pointer"
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
