import { useState, useEffect } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';

export default function AdminContactUsers() {
  const [users, setUsers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [target, setTarget] = useState('user'); // 'user' | 'course' | 'all'
  const [userSearch, setUserSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [text, setText] = useState('');

  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', message }

  useEffect(() => {
    const token = localStorage.getItem('token');
    const authHeader = { Authorization: `Bearer ${token}` };

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [usersRes, coursesRes] = await Promise.all([
          fetch('/api/user/admin/users', { headers: authHeader }),
          fetch('/api/courses/list')
        ]);
        if (!usersRes.ok) throw new Error('Failed to fetch users');
        if (!coursesRes.ok) throw new Error('Failed to fetch courses');
        const usersData = await usersRes.json();
        const coursesData = await coursesRes.json();
        setUsers(usersData || []);
        setCourses(coursesData.courses || []);
      } catch (err) {
        console.error('Error loading contact-user data:', err);
        setError(err.message || 'Failed to load users/courses.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const uniqueCourseIds = (() => {
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
    return ids;
  })();

  const filteredUsers = userSearch.trim()
    ? users.filter(u => {
        const q = userSearch.toLowerCase();
        return (
          (u.name || '').toLowerCase().includes(q) ||
          (u.fullName || '').toLowerCase().includes(q) ||
          (u.email || '').toLowerCase().includes(q) ||
          (u.mobileNumber || '').toLowerCase().includes(q)
        );
      })
    : [];

  const canSend =
    text.trim().length > 0 &&
    !sending &&
    (
      (target === 'user' && !!selectedUser) ||
      (target === 'course' && !!selectedCourseId) ||
      target === 'all'
    );

  const handleSend = async () => {
    if (!canSend) return;
    setSending(true);
    setFeedback(null);
    try {
      const body = { text: text.trim(), target };
      if (target === 'user') body.userId = selectedUser._id;
      if (target === 'course') body.courseId = selectedCourseId;

      const res = await fetch('/api/messages/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send message');

      setFeedback({ type: 'success', message: `Message sent to ${data.sentTo} user(s).` });
      setText('');
      setSelectedUser(null);
      setUserSearch('');
      setSelectedCourseId('');
    } catch (err) {
      console.error('Error sending message:', err);
      setFeedback({ type: 'error', message: err.message || 'Failed to send message.' });
    } finally {
      setSending(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-8 space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-display font-bold text-text-primary">Contact User</h1>
        <p className="text-xs md:text-sm text-text-secondary mt-1">
          Send a text message to a specific user, everyone, or everyone enrolled in a course. Messages appear in the recipient's inbox and auto-expire after 72 hours.
        </p>
      </div>

      {error && (
        <div className="bg-status-danger-bg border border-status-danger-text/30 text-status-danger-text rounded-xl p-3 text-xs font-semibold">
          {error}
        </div>
      )}

      <div className="bg-surface border border-border-default rounded-2xl p-4 md:p-6 space-y-5 shadow-sm">
        {/* Target mode */}
        <div className="space-y-2">
          <span className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">Send to</span>
          <div className="flex flex-wrap gap-2">
            {[
              { key: 'user', label: 'Specific user' },
              { key: 'course', label: 'Users of a course' },
              { key: 'all', label: 'All users' }
            ].map(opt => (
              <button
                key={opt.key}
                type="button"
                onClick={() => { setTarget(opt.key); setFeedback(null); }}
                className={`px-3.5 py-1.5 rounded-lg border text-xs font-semibold transition cursor-pointer ${
                  target === opt.key
                    ? 'bg-brand text-text-on-accent border-brand shadow-sm'
                    : 'bg-sunken text-text-secondary border-border-default hover:border-border-default/80'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Specific user search/select */}
        {target === 'user' && (
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">User</span>
            {selectedUser ? (
              <div className="flex items-center justify-between bg-accent-soft-bg border border-brand rounded-xl px-3.5 py-2.5">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-text-primary truncate">{selectedUser.fullName || selectedUser.name}</p>
                  <p className="text-[10px] text-text-tertiary truncate">{selectedUser.email}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedUser(null)}
                  className="text-[10px] font-bold text-brand hover:underline cursor-pointer whitespace-nowrap ml-3"
                >
                  Change
                </button>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  placeholder="Search by name, email, or mobile..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full px-4 py-2 bg-sunken border border-border-default hover:border-border-default/80 focus:border-brand text-text-primary placeholder:text-text-tertiary rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-brand font-medium transition"
                />
                {userSearch.trim() && (
                  <div className="max-h-56 overflow-y-auto bg-sunken border border-border-subtle rounded-xl divide-y divide-border-subtle">
                    {filteredUsers.length === 0 ? (
                      <p className="text-[11px] text-text-tertiary p-3">No matching users.</p>
                    ) : (
                      filteredUsers.slice(0, 30).map(u => (
                        <button
                          key={u._id}
                          type="button"
                          onClick={() => { setSelectedUser(u); setUserSearch(''); }}
                          className="w-full text-left px-3.5 py-2.5 hover:bg-surface-raised transition cursor-pointer"
                        >
                          <p className="text-xs font-bold text-text-primary truncate">{u.fullName || u.name}</p>
                          <p className="text-[10px] text-text-tertiary truncate">{u.email}</p>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Course filter select */}
        {target === 'course' && (
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">Course</span>
            <select
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className="w-full px-4 py-2 bg-sunken border border-border-default hover:border-border-default/80 focus:border-brand text-text-primary rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-brand font-medium transition"
            >
              <option value="">Select a course...</option>
              {uniqueCourseIds.map(cid => {
                const course = courses.find(c => c.courseId === cid);
                return (
                  <option key={cid} value={cid}>{course ? course.name : cid}</option>
                );
              })}
            </select>
          </div>
        )}

        {/* Message text */}
        <div className="space-y-2">
          <span className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">Message</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            placeholder="Type your message..."
            className="w-full px-4 py-3 bg-sunken border border-border-default hover:border-border-default/80 focus:border-brand text-text-primary placeholder:text-text-tertiary rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-brand font-medium transition resize-none"
          />
        </div>

        {feedback && (
          <div className={`rounded-xl p-3 text-xs font-semibold border ${
            feedback.type === 'success'
              ? 'bg-status-success-bg border-status-success-text/30 text-status-success-text'
              : 'bg-status-danger-bg border-status-danger-text/30 text-status-danger-text'
          }`}>
            {feedback.message}
          </div>
        )}

        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          className="w-full py-2.5 bg-brand hover:bg-brand-hover disabled:opacity-40 disabled:cursor-not-allowed text-text-on-accent rounded-xl text-xs font-bold transition cursor-pointer shadow-sm"
        >
          {sending ? 'Sending...' : 'Send Message'}
        </button>
      </div>
    </div>
  );
}
