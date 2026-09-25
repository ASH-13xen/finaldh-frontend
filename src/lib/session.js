// Client side of the backend's single-active-session rule (finaldh utils/session.js).

const DEVICE_KEY = "dh_device_id";

// Stable per-browser id so the backend can tell "same device signing back in" from
// "another device". Clearing site data makes this browser a new device.
export const getDeviceId = () => {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return undefined;
  }
};

// Fired by the fetch wrapper in main.jsx when the backend rejects a request because
// the session ended; App listens and signs the user out with detail.error as the reason.
export const SESSION_ENDED_EVENT = "dh:session-ended";

// Login refused with 409 SESSION_ACTIVE: tell the user when this device can get in.
export const describeLoginBlock = (data) => {
  const retryAt = new Date(data.retryAt);
  const mins = Math.max(1, Math.ceil((retryAt - Date.now()) / 60000));
  const time = retryAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return data.loggedOut
    ? `This account was just used on ${data.device}. To prevent account sharing, a different device can sign in only after an hour - try again at ${time} (in ${mins} min).`
    : `This account is signed in on ${data.device}. Log out there first - this device can sign in about an hour after that one was last used (around ${time}).`;
};
