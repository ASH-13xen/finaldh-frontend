import { useState } from 'react';

// Shared UPI checkout modal - the single source of truth for "pay via UPI screenshot,
// wait for admin approval" used by both Course purchases and MCQ test purchases. Extracted
// from PurchaseCourses.jsx's original inline checkout modal so both flows render and behave
// identically, not just look similar.
export default function PurchaseModal({
  title,
  price,
  submitEndpoint,
  formFields,
  onClose,
  onSubmitted,
  telegramMessage,
  telegramTrackEndpointBase
}) {
  const [upiTxnId, setUpiTxnId] = useState('');
  const [screenshot, setScreenshot] = useState(null);
  const [screenshotPreview, setScreenshotPreview] = useState('');
  const [modalError, setModalError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [zoomQr, setZoomQr] = useState(false);
  const [lastSubmittedRequest, setLastSubmittedRequest] = useState(null);

  const handleScreenshotChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setModalError('Please upload an image file (PNG, JPG, JPEG).');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setModalError('Screenshot size must be under 10MB.');
      return;
    }

    setModalError('');
    setScreenshot(file);
    const reader = new FileReader();
    reader.onloadend = () => setScreenshotPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setModalError('');
    setSuccessMessage('');

    if (!screenshot) {
      setModalError('Please upload the screenshot of your payment.');
      return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      Object.entries(formFields || {}).forEach(([key, value]) => formData.append(key, value));
      formData.append('upiTxnId', upiTxnId.trim());
      formData.append('screenshot', screenshot);

      const res = await fetch(submitEndpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit request');

      setLastSubmittedRequest(data.request);
      setSuccessMessage('Payment submitted! Admin will verify and activate access within 6-8 hours.');
    } catch (err) {
      console.error('Error submitting purchase request:', err);
      setModalError(err.message || 'Error occurred while processing request.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTelegramNotify = () => {
    if (!lastSubmittedRequest) return;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    let telegramUrl = `https://t.me/tdhadmin?text=${encodeURIComponent(telegramMessage)}`;
    if (!isMobile) {
      telegramUrl = `https://web.telegram.org/k/#@tdhadmin`;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(telegramMessage).catch(() => {});
      }
    }
    window.open(telegramUrl, '_blank');

    const token = localStorage.getItem('token');
    fetch(`${telegramTrackEndpointBase}/${lastSubmittedRequest._id}/notify-telegram`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(async (res) => {
        const data = await res.json();
        if (res.ok) {
          setLastSubmittedRequest((prev) => ({ ...prev, telegramNotificationCount: data.telegramNotificationCount }));
        }
      })
      .catch((err) => console.error('[Telegram Notify] tracking failed:', err));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink-950/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-surface border border-border-default rounded-xl md:rounded-2xl w-full max-w-lg p-5 md:p-6 shadow-2xl relative my-auto max-h-[95vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-6">
          <div>
            <span className="text-[9px] font-bold text-brand bg-accent-soft-bg border border-accent-soft-border rounded px-1.5 py-0.5 uppercase tracking-wide">
              UPI Payment Checkout
            </span>
            <h3 className="text-base md:text-lg font-display font-semibold text-text-primary mt-1.5 leading-snug">
              {title}
            </h3>
            <p className="text-[11px] text-text-secondary mt-1 font-medium">Complete standard payment verification for access.</p>
          </div>
          <button onClick={onClose} className="text-text-secondary hover:text-text-primary p-1 hover:bg-sunken rounded-lg transition cursor-pointer">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {successMessage ? (
          <div className="py-8 text-center flex flex-col items-center justify-center space-y-4">
            <div className="w-16 h-16 bg-accent-soft-bg border border-accent-soft-border text-brand rounded-full flex items-center justify-center shadow-lg animate-bounce">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-8 h-8"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <h4 className="text-base font-display font-semibold text-text-primary">Purchase Request Pending</h4>
            <p className="text-xs text-text-secondary max-w-xs leading-relaxed font-medium">{successMessage}</p>
            {telegramMessage && lastSubmittedRequest && lastSubmittedRequest.telegramNotificationCount < 2 && (
              <div className="w-full max-w-xs pt-2">
                <button
                  type="button"
                  onClick={handleTelegramNotify}
                  className="w-full px-4 py-2.5 bg-brand hover:bg-brand-hover text-text-on-accent rounded-xl text-xs font-bold transition shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4 10-10S17.52 2 12 2zm4.64 6.8c-.15.75-.85 3.79-1.2 5.68-.15.8-.45 1.07-.73 1.1-.63.06-1.11-.42-1.72-.82-.96-.63-1.51-1.02-2.44-1.63-1.08-.71-.38-1.1.24-1.74.16-.17 3.01-2.76 3.07-3.01.01-.03.01-.14-.05-.2-.06-.06-.15-.04-.21-.03-.1.02-1.61 1.02-4.56 3.02-.43.3-.82.45-1.17.44-.39-.01-1.15-.22-1.71-.41-.69-.23-1.24-.35-1.19-.74.03-.2.3-.41.82-.63 3.2-1.39 5.34-2.31 6.42-2.75 3.07-1.28 3.7-1.5 4.12-1.5.09 0 .3.02.43.13.11.09.14.22.15.31-.01.07.01.21-.01.29z"/></svg>
                  Notify Admin on Telegram
                </button>
                <p className="text-[10px] text-text-tertiary mt-2 text-center font-medium leading-relaxed">
                  Notify us personally or request for the Telegram group link.
                </p>
              </div>
            )}
            <button onClick={() => onSubmitted?.(lastSubmittedRequest)} className="px-6 py-2 bg-accent-soft-bg border border-accent-soft-border hover:bg-accent-soft-border/50 text-brand rounded-xl text-xs font-bold transition cursor-pointer mt-4">
              Close Window
            </button>
          </div>
        ) : (
          <form onSubmit={handleFormSubmit} className="space-y-5">
            <div className="bg-accent-soft-bg border border-accent-soft-border rounded-xl p-3 text-[10px] md:text-xs text-text-secondary leading-relaxed font-medium flex gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4 text-brand flex-shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="9" x2="12.01" y2="9"/></svg>
              <div>
                <span className="font-bold text-brand block mb-0.5">Notice:</span>
                This is a temporary payment option. We are actively working on improving the payment experience. For queries or support, please message us on Telegram or contact us via Email.
              </div>
            </div>

            {modalError && (
              <div className="p-3 bg-status-danger-bg border border-status-danger-text/25 text-status-danger-text rounded-xl text-xs font-bold leading-normal">
                {modalError}
              </div>
            )}

            <div className="bg-sunken border border-border-subtle rounded-2xl p-4 md:p-5 flex flex-col items-center text-center space-y-4 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-brand to-transparent animate-pulse"></div>
              <p className="text-xs text-text-secondary font-semibold leading-relaxed">
                Scan the QR code below using GPay, PhonePe, Paytm, or any UPI app to transfer{' '}
                <span className="text-brand font-extrabold text-sm">₹{price}</span>. Click the QR code to view it full size.
              </p>
              <div
                onClick={() => setZoomQr(true)}
                className="relative p-2.5 bg-white rounded-xl shadow-xl group border border-border-default w-40 h-40 md:w-44 md:h-44 flex items-center justify-center cursor-zoom-in hover:border-brand/40 transition-colors"
              >
                <img src="/qr/payment_qr.jpg" alt="UPI Payment QR Code" className="w-36 h-36 md:w-40 md:h-40 object-contain" />
                <div className="absolute inset-x-2.5 h-[2px] bg-brand/80 animate-[scan_2s_ease-in-out_infinite] pointer-events-none shadow-[0_0_10px_var(--color-brand)]"></div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] md:text-xs font-bold text-text-secondary uppercase tracking-wider">
                  UPI Transaction ID / Ref No. (Optional)
                </label>
                <input
                  type="text"
                  maxLength={24}
                  className="w-full bg-page border border-border-default hover:border-text-tertiary focus:border-brand text-text-primary rounded-xl px-4 py-3 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-brand transition-all placeholder:text-text-tertiary"
                  placeholder="e.g. 123456789012"
                  value={upiTxnId}
                  onChange={(e) => {
                    setUpiTxnId(e.target.value.replace(/[^0-9a-zA-Z]/g, ''));
                    if (e.target.value.trim()) setModalError('');
                  }}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] md:text-xs font-bold text-text-secondary uppercase tracking-wider block">
                  Upload Payment Screenshot
                </label>
                {screenshotPreview ? (
                  <div className="relative rounded-xl border border-border-default bg-page p-2 flex items-center gap-3">
                    <img src={screenshotPreview} alt="Screenshot preview" className="w-12 h-12 rounded object-cover border border-border-default" />
                    <div className="flex-grow min-w-0">
                      <p className="text-[11px] text-text-secondary font-bold truncate">{screenshot.name}</p>
                      <p className="text-[9px] text-text-tertiary font-medium">{(screenshot.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setScreenshot(null); setScreenshotPreview(''); }}
                      className="p-1 hover:bg-sunken text-text-secondary hover:text-status-danger-text rounded-lg transition cursor-pointer"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                ) : (
                  <div className="relative border-2 border-dashed border-border-default hover:border-brand/50 rounded-xl bg-page hover:bg-sunken/30 transition cursor-pointer">
                    <input type="file" accept="image/*" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={handleScreenshotChange} />
                    <div className="py-6 text-center space-y-1">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-8 h-8 text-text-tertiary mx-auto mb-1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                      <p className="text-[11px] text-brand font-bold">Click to upload or drag payment receipt</p>
                      <p className="text-[9px] text-text-tertiary font-medium">Supports PNG, JPG, JPEG (Max 10MB)</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border-default">
              <button type="button" onClick={onClose} disabled={submitting} className="px-4 py-2 text-text-secondary hover:text-text-primary text-xs font-bold transition cursor-pointer">
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2 bg-brand hover:bg-brand-hover disabled:bg-surface-raised disabled:border disabled:border-border-default disabled:text-text-tertiary text-text-on-accent rounded-xl text-xs font-bold transition shadow-md cursor-pointer flex items-center justify-center gap-1.5"
              >
                {submitting ? 'Uploading Receipt...' : 'Submit Payment Info'}
              </button>
            </div>
          </form>
        )}
      </div>

      {zoomQr && (
        <div
          className="fixed inset-0 z-[150] bg-ink-950/95 flex flex-col items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setZoomQr(false)}
        >
          <button onClick={() => setZoomQr(false)} className="absolute top-4 right-4 text-text-secondary hover:text-text-primary p-2 bg-surface/80 border border-border-default rounded-full hover:bg-sunken transition">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
          <img
            src="/qr/payment_qr.jpg"
            alt="UPI Payment QR Code Zoomed"
            className="max-w-full max-h-[80vh] object-contain rounded-2xl border border-border-default shadow-2xl p-4 bg-white"
            onClick={(e) => e.stopPropagation()}
          />
          <div className="text-text-secondary text-xs mt-4 font-bold uppercase tracking-wider select-none bg-surface/60 border border-border-default px-3 py-1.5 rounded-xl">
            Click outside QR code to close
          </div>
        </div>
      )}

      <style>{`
        @keyframes scan {
          0%, 100% { top: 10px; }
          50% { top: calc(100% - 12px); }
        }
      `}</style>
    </div>
  );
}
