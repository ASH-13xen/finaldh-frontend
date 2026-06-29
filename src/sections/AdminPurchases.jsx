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

  // Get full image URL by prepending backend server URL if path is relative.
  // Screenshots are served from an authenticated API route now (DB-backed, not a static file),
  // so <img> needs the token as a query param since it can't send an Authorization header.
  const getImageUrl = (path) => {
    if (!path) return '';
    const token = localStorage.getItem('token');
    const withToken = (url) => (token ? `${url}${url.includes('?') ? '&' : '?'}token=${token}` : url);
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return withToken(path);
    }
    const apiBaseUrl = import.meta.env.VITE_API_URL || '';
    return withToken(`${apiBaseUrl.replace(/\/$/, '')}${path}`);
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
    <div className="w-full max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-14 text-text-primary">
      {/* Header */}
      <div className="mb-8 md:mb-12 border-b border-border-default pb-4 md:pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-4xl font-display font-semibold text-text-primary tracking-tight flex flex-wrap items-center gap-2">
            Course Purchase Requests
            <span className="inline-block px-2.5 py-0.5 bg-accent-soft-bg border border-accent-soft-border text-brand text-[10px] font-bold rounded-full uppercase tracking-wider">
              Verification Desk
            </span>
          </h1>
          <p className="text-text-secondary text-xs md:text-sm mt-1.5 md:mt-2 font-medium">
            Review manual UPI payments, verify transaction IDs, inspect screenshots, and unlock resources for students.
          </p>
        </div>
        
        {/* Refresh button */}
        <button
          onClick={fetchRequests}
          className="px-4 py-2 bg-accent-soft-bg border border-accent-soft-border hover:bg-accent-soft-border/50 text-brand rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer self-start md:self-auto font-semibold"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border-default mb-6 gap-4">
        {['pending', 'approved', 'rejected', 'all'].map((tab) => {
          const count = requests.filter(r => tab === 'all' ? true : r.status === tab).length;
          return (
            <button
              key={tab}
              onClick={() => setFilterTab(tab)}
              className={`pb-3 text-xs md:text-sm font-bold uppercase tracking-wider border-b-2 cursor-pointer transition-all ${filterTab === tab ? 'border-brand text-brand font-extrabold' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
            >
              {tab} ({count})
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="py-16 text-center bg-surface border border-border-default rounded-2xl shadow-sm">
          <LoadingSpinner text="Retrieving purchase requests..." />
        </div>
      ) : error ? (
        <div className="py-12 text-center bg-status-danger-bg border border-status-danger-text/25 rounded-2xl p-6">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-8 h-8 text-status-danger-text mx-auto mb-3"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <h3 className="font-bold text-text-primary">Failed to load requests</h3>
          <p className="text-xs text-text-secondary mt-1">{error}</p>
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-border-default rounded-xl bg-surface-raised p-6">
          <p className="text-sm text-text-tertiary font-semibold">No {filterTab !== 'all' ? filterTab : ''} requests found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredRequests.map((req) => (
            <div 
              key={req._id}
              className="bg-surface border border-border-default rounded-xl md:rounded-2xl p-5 md:p-6 shadow-sm flex flex-col justify-between hover:border-brand/40 transition-all duration-300 relative overflow-hidden"
            >
              <div className="space-y-4">
                {/* Header Row: Student and Date */}
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-text-primary text-sm md:text-base leading-snug">{req.userName}</h3>
                    <p className="text-[11px] text-text-secondary font-medium font-mono">{req.userEmail}</p>
                  </div>
                  <span className="text-[9px] text-text-tertiary font-bold whitespace-nowrap">
                    {new Date(req.createdAt).toLocaleDateString(undefined, {
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                    })}
                  </span>
                </div>

                {/* Course Details Block */}
                <div className="p-3.5 bg-sunken border border-border-subtle rounded-xl space-y-2">
                  {req.comboOffer ? (
                    <>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-text-secondary font-medium">Combo:</span>
                        <span className="bg-accent-soft-bg border border-accent-soft-border text-brand font-bold text-right truncate max-w-xs rounded px-2 py-0.5 text-[11px]">
                          {req.comboOffer.label || req.courseName}
                        </span>
                      </div>
                      <div className="flex justify-between items-start text-xs gap-2">
                        <span className="text-text-secondary font-medium shrink-0">Courses:</span>
                        <div className="flex flex-wrap gap-1 justify-end">
                          {(req.courses && req.courses.length > 0 ? req.courses : []).map((c) => (
                            <span key={c._id} className="text-text-primary font-bold bg-surface border border-border-default rounded px-1.5 py-0.5 text-[10px]">
                              {c.name || c.courseId}
                            </span>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-text-secondary font-medium">Course:</span>
                        <span className="text-text-primary font-bold text-right truncate max-w-xs">{req.courseName}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-text-secondary font-medium">Course ID:</span>
                        <span className="text-brand font-bold uppercase">{req.courseId}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-text-secondary font-medium">Price:</span>
                    <span className="text-brand font-extrabold">₹{req.price}</span>
                  </div>
                </div>

                {/* UPI Transaction Block */}
                <div className="flex items-center justify-between p-3.5 bg-sunken border border-border-subtle rounded-xl text-xs gap-3">
                  <div className="min-w-0 flex-1">
                    <span className="text-[9px] text-text-tertiary block uppercase font-bold tracking-wider">UPI Transaction Ref (UTR)</span>
                    <span className="font-mono text-text-primary font-bold select-all tracking-wide break-all">{req.upiTxnId}</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(req.upiTxnId)}
                    className="p-2 bg-surface border border-border-default hover:bg-sunken text-text-secondary hover:text-text-primary rounded-lg transition active:scale-95 cursor-pointer shrink-0"
                    title="Copy to clipboard"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  </button>
                </div>

                {/* Screenshot Attachment view */}
                <div className="space-y-1.5">
                  <span className="text-[10px] text-text-secondary font-bold uppercase tracking-wider block">Receipt Screenshot</span>
                  <div 
                    onClick={() => setLightboxImage(req.screenshotUrl)}
                    className="relative group overflow-hidden border border-border-default hover:border-brand/40 rounded-xl aspect-[16/9] bg-page flex items-center justify-center cursor-zoom-in"
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
                    <div className="absolute inset-0 bg-ink-950/40 opacity-0 group-hover:opacity-100 transition duration-300 flex items-center justify-center text-xs text-white font-bold gap-1.5 backdrop-blur-[1px]">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" className="w-4 h-4"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                      Click to Zoom Image
                    </div>
                  </div>
                </div>
              </div>

              {/* Status and Action Buttons */}
              <div className="border-t border-border-default pt-4 mt-6 flex items-center justify-between gap-4">
                <span className="text-[10px] font-bold text-text-tertiary block uppercase tracking-wider">Request Status</span>
                
                {req.status === 'pending' ? (
                  <div className="flex gap-2.5">
                    <button
                      onClick={() => handleAction(req._id, 'reject')}
                      disabled={processingId === req._id}
                      className="px-3.5 py-1.5 border border-border-default hover:border-status-danger-text/60 hover:bg-status-danger-bg text-text-secondary hover:text-status-danger-text rounded-xl text-xs font-bold transition disabled:opacity-50 cursor-pointer"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => handleAction(req._id, 'approve')}
                      disabled={processingId === req._id}
                      className="px-4 py-1.5 bg-brand hover:bg-brand-hover disabled:bg-surface-raised text-text-on-accent rounded-xl text-xs font-bold transition shadow-md disabled:text-text-tertiary cursor-pointer flex items-center gap-1"
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
                  <span className="px-3.5 py-1 bg-status-success-bg border border-status-success-text/25 text-status-success-text rounded-xl text-xs font-extrabold uppercase tracking-wide">
                    Approved
                  </span>
                ) : (
                  <span className="px-3.5 py-1 bg-status-danger-bg border border-status-danger-text/20 text-status-danger-text rounded-xl text-xs font-extrabold uppercase tracking-wide">
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
          className="fixed inset-0 z-[150] bg-ink-950/95 flex flex-col items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          {/* Close button */}
          <button 
            onClick={() => setLightboxImage(null)}
            className="absolute top-4 right-4 text-text-secondary hover:text-text-primary p-2 bg-surface/85 border border-border-default rounded-full hover:bg-sunken transition cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
          
          <img 
            src={getImageUrl(lightboxImage)} 
            alt="Expanded Receipt Zoom" 
            className="max-w-full max-h-[85vh] object-contain rounded-lg border border-border-default shadow-2xl scale-in-95 duration-200"
            onClick={(e) => e.stopPropagation()} // Stop propagation to prevent closing
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
    </div>
  );
}
