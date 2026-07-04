import { useState, useEffect, useRef, useCallback } from 'react';

const POLL_INTERVAL_MS = 30000;

function timeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function InboxBell({ user }) {
  const [messages, setMessages] = useState([]);
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);

  const unreadCount = messages.filter(m => !m.read).length;

  const fetchInbox = useCallback(async () => {
    try {
      const res = await fetch('/api/messages/inbox', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data || []);
      }
    } catch (err) {
      console.warn('Error polling inbox:', err);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchInbox();
    const interval = setInterval(fetchInbox, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [user, fetchInbox]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const listener = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', listener);
    return () => document.removeEventListener('mousedown', listener);
  }, [open]);

  const handleMarkRead = async (id) => {
    setMessages((prev) => prev.map(m => (m._id === id ? { ...m, read: true } : m)));
    try {
      await fetch(`/api/messages/${id}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
    } catch (err) {
      console.warn('Error marking message read:', err);
    }
  };

  const handleDelete = async (id) => {
    setMessages((prev) => prev.filter(m => m._id !== id));
    try {
      await fetch(`/api/messages/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
    } catch (err) {
      console.warn('Error deleting message:', err);
    }
  };

  if (!user) return null;

  return (
    <div ref={panelRef} className="relative shrink-0">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Inbox"
        title="Inbox"
        className="relative w-7 h-7 md:w-8 md:h-8 flex items-center justify-center rounded-full border border-border-default text-text-secondary hover:text-text-primary hover:bg-surface-raised transition-all duration-200 cursor-pointer"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 md:w-4 md:h-4">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-status-danger-text text-white text-[9px] font-bold leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-[calc(100%+10px)] right-0 w-80 max-w-[85vw] bg-surface border border-border-default rounded-2xl shadow-2xl flex flex-col overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="px-4 py-3 border-b border-border-default flex items-center justify-between">
            <span className="text-xs font-bold text-text-primary uppercase tracking-wider">Inbox</span>
            {unreadCount > 0 && <span className="text-[10px] font-bold text-brand">{unreadCount} unread</span>}
          </div>
          <div className="max-h-80 overflow-y-auto divide-y divide-border-subtle">
            {messages.length === 0 ? (
              <p className="text-[11px] text-text-tertiary p-4 text-center">No messages.</p>
            ) : (
              messages.map((m) => (
                <div
                  key={m._id}
                  onClick={() => !m.read && handleMarkRead(m._id)}
                  className={`px-4 py-3 flex items-start gap-2.5 transition cursor-pointer hover:bg-surface-raised ${!m.read ? 'bg-accent-soft-bg/40' : ''}`}
                >
                  <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${!m.read ? 'bg-brand' : 'bg-transparent'}`} />
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs whitespace-pre-wrap break-words ${!m.read ? 'font-bold text-text-primary' : 'font-medium text-text-secondary'}`}>
                      {m.text}
                    </p>
                    <p className="text-[9px] text-text-tertiary mt-1">{timeAgo(m.createdAt)}</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(m._id); }}
                    aria-label="Delete message"
                    className="shrink-0 p-1 text-text-tertiary hover:text-status-danger-text transition cursor-pointer"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
                      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
