// Kept as plain JavaScript so Layout can inline this before either analytics SDK.
// The module import in analytics.ts provides the same guard without Layout.
(() => {
  if (window.__hanApplyAnalyticsControl) return;

  const storageKey = 'hanparkdesign:posthog-disabled';
  const cookieName = 'hanparkdesign-posthog-disabled';
  const cookieAttributes = `; Path=/; SameSite=Lax${window.location.protocol === 'https:' ? '; Secure' : ''}`;
  let controlApplied = false;

  const applyAnalyticsControl = () => {
    // Apply the URL command once per document. Replaying an old ?analytics=on
    // during a Safari back/forward-cache restore must not erase a newer opt-out.
    const control = controlApplied ? null : new URLSearchParams(window.location.search).get('analytics');
    controlApplied = true;

    if (control === 'off' || control === 'on') {
      // Separate attempts: failure of one storage mechanism must not skip the other.
      try {
        if (control === 'off') window.localStorage.setItem(storageKey, 'true');
        else window.localStorage.removeItem(storageKey);
      } catch {
        // The first-party cookie remains available as a fallback.
      }
      try {
        document.cookie = control === 'off'
          ? `${cookieName}=true; Max-Age=31536000${cookieAttributes}`
          : `${cookieName}=; Max-Age=0${cookieAttributes}`;
      } catch {
        // localStorage and the in-memory state still protect the current page.
      }
      window.__hanAnalyticsDisabled = control === 'off';
    }

    let storageDisabled = false;
    let cookieDisabled = false;
    try {
      storageDisabled = window.localStorage.getItem(storageKey) === 'true';
    } catch {
      // Check the cookie even if accessing localStorage throws.
    }
    try {
      cookieDisabled = document.cookie.split(';').some((cookie) => cookie.trim() === `${cookieName}=true`);
    } catch {
      // Check localStorage even if accessing cookies throws.
    }

    // Retain OFF in this document even when both persistence attempts failed.
    // An unreadable/uncleared disabled marker never permits initialization.
    const disabled = window.__hanAnalyticsDisabled === true || storageDisabled || cookieDisabled;
    window.__hanAnalyticsDisabled = disabled;
    return disabled;
  };

  window.__hanApplyAnalyticsControl = applyAnalyticsControl;
  applyAnalyticsControl();
  window.webAnalyticsBeforeSend = (event) => (applyAnalyticsControl() ? null : event);
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) applyAnalyticsControl();
  });
})();
