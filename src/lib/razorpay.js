// Razorpay Standard Checkout, driven by our backend's /api/payments endpoints (the server half of the flow,
// including the webhook, is in backend/controllers/paymentController.js).
const CHECKOUT_SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js';

let scriptPromise = null;

// Loaded on first purchase only, so pages that never sell anything don't pull Razorpay's script.
export function loadRazorpayCheckout() {
  if (window.Razorpay) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = CHECKOUT_SCRIPT;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        scriptPromise = null;
        script.remove();
        reject(new Error('Could not load Razorpay. Check your internet connection and try again.'));
      };
      document.body.appendChild(script);
    });
  }
  return scriptPromise;
}

class PaymentApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function paymentsApi(path, { method = 'GET', body } = {}) {
  const headers = { Authorization: `Bearer ${localStorage.getItem('token') || ''}` };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(`/api/payments${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch {
    throw new PaymentApiError('Could not reach the server. Check your internet connection and try again.', 0);
  }

  let data = null;
  try { data = await res.json(); } catch { /* empty / non-JSON body */ }
  if (!res.ok) throw new PaymentApiError(data?.error || `Something went wrong (${res.status}).`, res.status);
  return data;
}

const checkStatus = (orderId) => paymentsApi(`/orders/${orderId}/status`).catch(() => null);

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Checkout's accent colour; Razorpay only takes hex
const brandColor = () => {
  const value = getComputedStyle(document.documentElement).getPropertyValue('--color-brand').trim();
  return /^#[0-9a-f]{3,8}$/i.test(value) ? value : undefined;
};

// Runs one purchase end to end. `item` is what POST /api/payments/order expects:
//   { kind: 'course', courseId } | { kind: 'combo', comboOfferId, selectedCourseIds } | { kind: 'mcq_subject', subject }
// onStage reports progress: 'starting' -> 'paying' (Razorpay's own window is open) -> 'confirming'.
// Resolves with one of:
//   { status: 'paid', payment }      access is granted
//   { status: 'cancelled' }          the student closed Checkout without paying
//   { status: 'failed', reason }     the last attempt failed and the student closed Checkout
//   { status: 'processing' }         paid, but the server couldn't confirm it yet (webhook will finish it)
// Throws on errors before any money moves (order refused, script blocked) or a rejected signature.
export async function payWithRazorpay(item, { onStage } = {}) {
  onStage?.('starting');
  const [order] = await Promise.all([paymentsApi('/order', { method: 'POST', body: item }), loadRazorpayCheckout()]);

  const outcome = await new Promise((resolve, reject) => {
    let lastFailure = '';
    try {
      const checkout = new window.Razorpay({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amount,
        currency: order.currency,
        name: 'The Dark Horse UPSC',
        description: order.itemLabel,
        prefill: order.prefill,
        theme: { color: brandColor() },
        handler: (response) => resolve({ response }),
        modal: { confirm_close: true, ondismiss: () => resolve({ dismissed: true, lastFailure }) }
      });
      // Checkout shows the failure itself and lets the student retry, so this only remembers why
      checkout.on('payment.failed', (res) => { lastFailure = res?.error?.description || 'Payment failed'; });
      checkout.open();
      onStage?.('paying');
    } catch (err) {
      reject(err);
    }
  });

  if (outcome.dismissed) {
    // A UPI payment can still complete in the student's app after they close the window - ask once
    const status = await checkStatus(order.orderId);
    if (status?.status === 'paid') return status;
    return outcome.lastFailure ? { status: 'failed', reason: outcome.lastFailure } : { status: 'cancelled' };
  }

  onStage?.('confirming');
  try {
    const verified = await paymentsApi('/verify', { method: 'POST', body: outcome.response });
    if (verified?.status === 'paid') return verified;
  } catch (err) {
    if (err.status === 400 || err.status === 404) throw err;
  }

  // Verification didn't complete (network drop, or Razorpay still capturing) - keep asking for a bit
  for (let i = 0; i < 5; i++) {
    await wait(2000);
    const status = await checkStatus(order.orderId);
    if (status?.status === 'paid') return status;
  }
  return { status: 'processing' };
}
