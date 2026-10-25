import { useState, useEffect } from 'react';

const STATUS_STYLES = {
  queued: 'bg-status-warning-bg text-status-warning-text border-status-warning-text/30',
  ready: 'bg-status-info-bg text-status-info-text border-status-info-text/30',
  delivered: 'bg-status-success-bg text-status-success-text border-status-success-text/30',
  failed: 'bg-status-danger-bg text-status-danger-text border-status-danger-text/30'
};

const formatIST = (iso) =>
  new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' IST';

// Admin tool: given the License ID printed on every page of a leaked PDF (or an email / name), show who
// the copy was issued to, when, and from which IP address.
export default function AdminDownloadTrace() {
  const [query, setQuery] = useState('');
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');

  const [activeQuery, setActiveQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/courses/admin/download-logs?q=${encodeURIComponent(activeQuery)}&limit=100`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Search failed');
        if (!cancelled) setLogs(data.logs || []);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Search failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [activeQuery]);

  const submitSearch = (q) => { setLoading(true); setError(''); setActiveQuery(q); };

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(text);
      setTimeout(() => setCopied(''), 1500);
    } catch { /* clipboard unavailable - ignore */ }
  };

  return (
    <div className="space-y-5">
      <div className="bg-accent-soft-bg border border-accent-soft-border rounded-2xl p-5 text-sm text-text-secondary leading-relaxed">
        <p className="font-bold text-text-primary mb-1">How to trace a leaked PDF</p>
        Every secured PDF carries a <span className="font-semibold text-text-primary">License ID</span> (format <span className="font-mono">DH-XXXX-XXXX-XXXX</span>)
        in the strip at the bottom of each page, and again as hidden text. Paste it below to see who the copy was issued to, when, and from which IP.
        If the visible strip was cropped out, the hidden ID can still be read from the file with
        <span className="font-mono"> node scripts/trace_pdf.mjs leaked.pdf</span>.
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); submitSearch(query.trim()); }}
        className="flex flex-col sm:flex-row gap-3"
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="License ID, student email, name or user id"
          className="flex-1 bg-surface border border-border-default hover:border-text-tertiary focus:border-brand text-text-primary rounded-xl px-4 py-3 text-sm font-semibold transition-all"
        />
        <button type="submit" className="px-6 py-3 bg-brand hover:bg-brand-hover text-text-on-accent rounded-xl text-sm font-bold transition cursor-pointer">
          Search
        </button>
      </form>

      {error && <div className="p-3 bg-status-danger-bg border border-status-danger-text/30 rounded-xl text-status-danger-text text-sm font-semibold">{error}</div>}

      {loading ? (
        <p className="text-sm text-text-tertiary py-10 text-center">Searching…</p>
      ) : logs.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-border-default rounded-2xl bg-surface-raised text-sm text-text-tertiary font-semibold">
          No downloads found.
        </div>
      ) : (
        <div className="bg-surface border border-border-default rounded-2xl overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-sunken text-text-tertiary text-xs uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">License ID</th>
                <th className="px-4 py-3">Issued to</th>
                <th className="px-4 py-3">Course</th>
                <th className="px-4 py-3">Issued</th>
                <th className="px-4 py-3">IP address</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {logs.map((l) => (
                <tr key={l._id} className="align-top hover:bg-surface-raised">
                  <td className="px-4 py-3">
                    <button onClick={() => copy(l.licenseId)} title="Click to copy" className="font-mono font-bold text-brand hover:underline cursor-pointer">
                      {copied === l.licenseId ? 'Copied ✓' : l.licenseId}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-text-primary">{l.userName || '—'}</p>
                    <p className="text-xs text-text-secondary">{l.userEmail}</p>
                    {l.userMobile && <p className="text-xs text-text-tertiary">{l.userMobile}</p>}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{l.courseName || l.courseId}</td>
                  <td className="px-4 py-3 text-text-secondary whitespace-nowrap">{formatIST(l.issuedAt)}</td>
                  <td className="px-4 py-3 text-xs text-text-secondary">
                    <p className="font-mono">{l.ip || '—'}</p>
                    {l.userAgent && <p className="text-text-tertiary max-w-56 truncate" title={l.userAgent}>{l.userAgent}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-bold uppercase px-2 py-1 rounded border ${STATUS_STYLES[l.status] || ''}`}>{l.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
