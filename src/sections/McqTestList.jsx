import { useState, useEffect } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';
import Button from '../components/Button';
import PurchaseModal from '../components/PurchaseModal';

export default function McqTestList({ subject, onSelectTest, onBack, user }) {
  const [tests, setTests] = useState([]);
  const [subjectAccess, setSubjectAccess] = useState(null);
  const [purchaseRequests, setPurchaseRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showSubjectPurchase, setShowSubjectPurchase] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const [testsRes, requestsRes] = await Promise.all([
        fetch(`/api/mcq/tests?subject=${encodeURIComponent(subject)}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/mcq/purchase-requests', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      const testsData = await testsRes.json();
      if (!testsRes.ok) throw new Error(testsData.error || 'Failed to load tests');
      setTests(testsData.tests || []);
      setSubjectAccess(testsData.subjectAccess || null);
      if (requestsRes.ok) setPurchaseRequests(await requestsRes.json());
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to load tests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject]);

  const subjectPending = purchaseRequests.find(r => r.purchaseType === 'subject' && r.subject === subject && r.status === 'pending');
  const subjectRejected = purchaseRequests.find(r => r.purchaseType === 'subject' && r.subject === subject && r.status === 'rejected');
  const subjectPrice = subjectAccess?.useDiscount ? subjectAccess.discountedPrice : subjectAccess?.price;
  const pricingConfigured = subjectAccess?.price !== null && subjectAccess?.price !== undefined;

  const handleCardClick = (test) => {
    if (test.isOwned) onSelectTest(test);
    // Locked tests aren't individually clickable-to-buy anymore - unlocking happens at the
    // subject level via the banner above. Clicking a locked card is a no-op.
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-73px)] bg-page">
        <LoadingSpinner text="Loading tests..." />
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-6 py-10 md:py-14 flex flex-col gap-8">
      <div className="flex items-center justify-between border-b border-border-default pb-5">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-extrabold text-text-primary tracking-tight">{subject}</h1>
          <p className="text-text-tertiary text-sm mt-1.5 font-medium">Choose a test to begin.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={onBack}>Back to Subjects</Button>
      </div>

      {error && (
        <div className="p-4 bg-status-danger-bg border border-status-danger-text/30 rounded-xl text-status-danger-text text-sm font-semibold">{error}</div>
      )}

      {/* Subject-level unlock banner - buying here unlocks every locked test in this subject,
          including ones added later, instead of buying tests one at a time. */}
      {subjectAccess?.hasLockedTests && !subjectAccess.isOwned && (
        <div className="bg-accent-soft-bg border border-accent-soft-border rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-brand mb-1">Unlock everything in {subject}</p>
            <p className="text-sm text-text-primary font-semibold">
              {subjectPending
                ? 'Your purchase request is pending admin approval.'
                : subjectRejected
                ? 'Your last request was rejected — you can submit a new one below.'
                : pricingConfigured
                ? 'One purchase unlocks every test in this subject, now and in the future.'
                : 'Pricing for this subject is being set up — check back soon.'}
            </p>
          </div>
          {subjectPending ? (
            <span className="px-5 py-2.5 bg-status-warning-bg border border-status-warning-text/30 text-status-warning-text rounded-xl text-xs font-bold uppercase whitespace-nowrap">Pending Approval</span>
          ) : pricingConfigured ? (
            <button
              onClick={() => setShowSubjectPurchase(true)}
              className="px-6 py-3 bg-brand hover:bg-brand-hover text-text-on-accent rounded-xl text-sm font-extrabold whitespace-nowrap transition shadow-sm cursor-pointer"
            >
              Buy Full Subject — ₹{subjectPrice}
            </button>
          ) : null}
        </div>
      )}

      {subjectAccess?.hasLockedTests && subjectAccess.isOwned && (
        <div className="bg-status-success-bg border border-status-success-text/30 rounded-2xl p-4 text-status-success-text text-sm font-bold text-center">
          ✓ You have full access to every test in {subject}
        </div>
      )}

      {!error && tests.length === 0 && (
        <div className="bg-surface border border-border-default rounded-2xl p-16 text-center text-text-tertiary">
          No tests available for this subject yet.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tests.map((test) => {
          const locked = !test.isOwned;
          return (
            <div
              key={test._id}
              onClick={() => handleCardClick(test)}
              className={`bg-surface border rounded-2xl p-6 flex flex-col justify-between transition-all duration-200 group ${
                locked ? 'border-border-default opacity-70 cursor-default' : 'border-border-default hover:border-brand hover:shadow-lg hover:-translate-y-0.5 cursor-pointer'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-bold text-text-primary text-sm group-hover:text-brand transition-colors leading-relaxed">
                    {test.title}
                  </h3>
                  {locked && (
                    <span className="flex-shrink-0 text-[9px] font-bold uppercase px-2 py-0.5 rounded bg-status-warning-bg border border-status-warning-text/30 text-status-warning-text">
                      🔒 Locked
                    </span>
                  )}
                </div>
                {test.description && (
                  <p className="text-[11px] text-text-tertiary leading-relaxed line-clamp-2">{test.description}</p>
                )}
                <div className="flex flex-wrap gap-1.5 text-[9px] font-bold uppercase">
                  <span className="bg-sunken text-text-secondary rounded px-2 py-0.5">{test.durationMinutes} min</span>
                  <span className="bg-sunken text-text-secondary rounded px-2 py-0.5">{test.questionCount} Qs</span>
                  <span className="bg-sunken text-text-secondary rounded px-2 py-0.5">{test.totalMarks} marks</span>
                  {test.negativeMarkingRatio > 0 && (
                    <span className="bg-status-danger-bg text-status-danger-text border border-status-danger-text/30 rounded px-2 py-0.5">-{test.negativeMarkingRatio}</span>
                  )}
                  {!test.requiresPurchase && (
                    <span className="bg-status-success-bg text-status-success-text border border-status-success-text/30 rounded px-2 py-0.5">Free</span>
                  )}
                </div>
                {test.lastAttempt && (
                  <div className="pt-1 text-[10px] text-brand font-semibold">
                    Last attempt: {test.lastAttempt.score}/{test.totalMarks} ({test.lastAttempt.accuracyPercent}% accuracy)
                  </div>
                )}
              </div>
              <div className="pt-6 mt-6 border-t border-border-default flex items-center justify-between">
                <span className="text-[10px] text-text-tertiary font-semibold uppercase">
                  {locked ? 'Unlock the subject above' : (test.lastAttempt ? 'Retake' : 'Start')}
                </span>
                {!locked && (
                  <span className="text-xs font-bold text-brand flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                    Open
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showSubjectPurchase && (
        <PurchaseModal
          title={`Unlock: ${subject} (all tests)`}
          price={subjectPrice}
          submitEndpoint="/api/mcq/purchase-requests"
          formFields={{ subject }}
          onClose={() => setShowSubjectPurchase(false)}
          onSubmitted={() => { setShowSubjectPurchase(false); fetchData(); }}
          telegramMessage={`I am ${user?.fullName || user?.name || 'Student'}, requesting confirmation for full subject access: ${subject}`}
          telegramTrackEndpointBase="/api/mcq/purchase-requests"
        />
      )}
    </div>
  );
}
