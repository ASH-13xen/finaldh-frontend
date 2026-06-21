import { useState, useEffect } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';

export default function AdminPurchases() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processingId, setProcessingId] = useState(null);
  
  // Filter Tabs
  const [filterTab, setFilterTab] = useState('pending'); // 'pending', 'approved', 'rejected', 'all'
  
  // Lightbox Image Zoom
  const [lightboxImage, setLightboxImage] = useState(null);

  // Get full image URL by prepending backend server URL if path is relative
  const getImageUrl = (path) => {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }
    const apiBaseUrl = import.meta.env.VITE_API_URL || '';
    return `${apiBaseUrl.replace(/\/$/, '')}${path}`;
  };

  const fetchRequests = async () => {
    setLoading(true);
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
      setRequests(data || []);
    } catch (err) {
      console.error('Error fetching admin requests:', err);
      setError(err.message || 'Failed to load purchase requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleAction = async (requestId, action) => {
    setProcessingId(requestId);
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
      
      // Update local request state instantly
      setRequests(prev => prev.map(r => r._id === requestId ? { ...r, status: action === 'approve' ? 'approved' : 'rejected' } : r));
    } catch (err) {
      alert(err.message || `Error executing action ${action}`);
    } finally {
      setProcessingId(null);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    // Visual alert could be added, but standard clipboard alert is fine
  };

  // Filtered requests based on active tab
  const filteredRequests = requests.filter(r => {
    if (filterTab === 'all') return true;
    return r.status === filterTab;
  });

  return (
    <div className="w-full max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-14">
      {/* Header */}
      <div className="mb-8 md:mb-12 border-b border-slate-800 pb-4 md:pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            Course Purchase Requests
            <span className="px-2.5 py-0.5 bg-accent-500/10 border border-accent-500/20 text-accent-400 text-xs font-black rounded-full uppercase tracking-wider">
              Verification Desk
            </span>
          </h1>
          <p className="text-slate-400 text-xs md:text-sm mt-1.5 font-medium">
            Review manual UPI payments, verify transaction IDs, inspect screenshots, and unlock resources for students.
          </p>
        </div>
        
        {/* Refresh button */}
        <button
          onClick={fetchRequests}
          className="px-4 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer self-start md:self-auto"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-850 mb-6 gap-4">
        {['pending', 'approved', 'rejected', 'all'].map((tab) => {
          const count = requests.filter(r => tab === 'all' ? true : r.status === tab).length;
          return (
            <button
              key={tab}
              onClick={() => setFilterTab(tab)}
              className={`pb-3 text-xs md:text-sm font-bold uppercase tracking-wider border-b-2 cursor-pointer transition-all ${filterTab === tab ? 'border-accent-550 text-accent-400 font-extrabold' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
            >
              {tab} ({count})
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="py-16 text-center bg-slate-900/40 border border-slate-800/80 rounded-2xl">
          <LoadingSpinner text="Retrieving purchase requests..." />
        </div>
      ) : error ? (
        <div className="py-12 text-center bg-rose-950/20 border border-rose-900/50 rounded-2xl p-6">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-8 h-8 text-rose-500 mx-auto mb-3"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <h3 className="font-bold text-white">Failed to load requests</h3>
          <p className="text-xs text-slate-400 mt-1">{error}</p>
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-slate-800 rounded-2xl bg-slate-900/20">
          <p className="text-sm text-slate-400 font-semibold">No {filterTab !== 'all' ? filterTab : ''} requests found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredRequests.map((req) => (
            <div 
              key={req._id}
              className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 md:p-6 shadow-xl flex flex-col justify-between hover:border-slate-700/80 transition-all duration-200 relative overflow-hidden"
            >
              <div className="space-y-4">
                {/* Header Row: Student and Date */}
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-extrabold text-slate-100 text-sm md:text-base leading-snug">{req.userName}</h3>
                    <p className="text-[11px] text-slate-450 font-medium">{req.userEmail}</p>
                  </div>
                  <span className="text-[9px] text-slate-500 font-bold whitespace-nowrap">
                    {new Date(req.createdAt).toLocaleDateString(undefined, {
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                    })}
                  </span>
                </div>

                {/* Course Details Block */}
                <div className="p-3.5 bg-slate-950/60 border border-slate-850 rounded-xl space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-medium">Course:</span>
                    <span className="text-slate-200 font-bold text-right truncate max-w-xs">{req.courseName}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-medium">Course ID:</span>
                    <span className="text-accent-400 font-extrabold uppercase">{req.courseId}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-medium">Price:</span>
                    <span className="text-emerald-450 font-extrabold">₹{req.price}</span>
                  </div>
                </div>

                {/* UPI Transaction Block */}
                <div className="flex items-center justify-between p-3.5 bg-slate-950/30 border border-slate-850 rounded-xl text-xs gap-3">
                  <div>
                    <span className="text-[9px] text-slate-450 block uppercase font-bold tracking-wider">UPI Transaction Ref (UTR)</span>
                    <span className="font-mono text-slate-200 font-bold select-all tracking-wide">{req.upiTxnId}</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(req.upiTxnId)}
                    className="p-2 bg-slate-900 border border-slate-800 hover:bg-slate-850 hover:border-slate-750 text-slate-450 hover:text-white rounded-lg transition active:scale-95 cursor-pointer"
                    title="Copy to clipboard"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  </button>
                </div>

                {/* Screenshot Attachment view */}
                <div className="space-y-1.5">
                  <span className="text-[10px] text-slate-450 font-bold uppercase tracking-wider block">Receipt Screenshot</span>
                  <div 
                    onClick={() => setLightboxImage(req.screenshotUrl)}
                    className="relative group overflow-hidden border border-slate-800 hover:border-accent-500/50 rounded-xl aspect-[16/9] bg-slate-950 flex items-center justify-center cursor-zoom-in"
                  >
                    <img 
                      src={getImageUrl(req.screenshotUrl)} 
                      alt="Payment Screenshot Receipt" 
                      className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = 'https://placehold.co/600x400/18181b/a1a1aa?text=Image+Unavailable';
                      }}
                    />
                    <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition duration-300 flex items-center justify-center text-xs text-white font-bold gap-1.5 backdrop-blur-[1px]">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" className="w-4 h-4"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                      Click to Zoom Image
                    </div>
                  </div>
                </div>
              </div>

              {/* Status and Action Buttons */}
              <div className="border-t border-slate-850 pt-4 mt-6 flex items-center justify-between gap-4">
                <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Request Status</span>
                
                {req.status === 'pending' ? (
                  <div className="flex gap-2.5">
                    <button
                      onClick={() => handleAction(req._id, 'reject')}
                      disabled={processingId === req._id}
                      className="px-3.5 py-1.5 border border-slate-800 hover:border-rose-900/60 hover:bg-rose-950/10 text-slate-400 hover:text-rose-500 rounded-xl text-xs font-bold transition disabled:opacity-50 cursor-pointer"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => handleAction(req._id, 'approve')}
                      disabled={processingId === req._id}
                      className="px-4 py-1.5 bg-accent-650 hover:bg-accent-500 disabled:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-md hover:shadow-accent-950/20 disabled:text-slate-500 cursor-pointer flex items-center gap-1"
                    >
                      {processingId === req._id ? 'Processing...' : (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-3 h-3"><polyline points="20 6 9 17 4 12"/></svg>
                          Approve
                        </>
                      )}
                    </button>
                  </div>
                ) : req.status === 'approved' ? (
                  <span className="px-3.5 py-1 bg-emerald-500/10 border border-emerald-500/25 text-emerald-450 rounded-xl text-xs font-extrabold uppercase tracking-wide">
                    Approved
                  </span>
                ) : (
                  <span className="px-3.5 py-1 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-xl text-xs font-extrabold uppercase tracking-wide">
                    Rejected
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxImage && (
        <div 
          className="fixed inset-0 z-[150] bg-slate-950/95 flex flex-col items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          {/* Close button */}
          <button 
            onClick={() => setLightboxImage(null)}
            className="absolute top-4 right-4 text-slate-300 hover:text-white p-2 bg-slate-900/80 border border-slate-800 rounded-full hover:bg-slate-800 transition"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
          
          <img 
            src={getImageUrl(lightboxImage)} 
            alt="Expanded Receipt Zoom" 
            className="max-w-full max-h-[85vh] object-contain rounded-lg border border-slate-850 shadow-2xl scale-in-95 duration-200"
            onClick={(e) => e.stopPropagation()} // Stop propagation to prevent closing
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
    </div>
  );
}
