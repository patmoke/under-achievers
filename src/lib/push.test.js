import { describe, it, expect } from 'vitest';
import { reminderOffer } from './push';

// A signed-in Android/desktop user who hasn't been asked yet.
const base = {
  ready: true,
  dismissed: false,
  subscribed: false,
  supported: true,
  permission: 'default',
  needsInstallFirst: false,
};

describe('reminderOffer', () => {
  it('offers to enable on a platform that supports push', () => {
    expect(reminderOffer(base)).toBe('enable');
  });

  it('offers install on iOS in a browser tab, where push APIs are absent', () => {
    // The regression this exists for: iOS Safari exposes neither PushManager
    // nor Notification, so `supported` is false — and checking that first hid
    // the install prompt from the one platform that requires installing.
    expect(reminderOffer({ ...base, supported: false, needsInstallFirst: true })).toBe('install');
  });

  it('still offers install when iOS reports permission as denied', () => {
    // Nothing has been denied; there was never an API to ask with.
    expect(reminderOffer({
      ...base, supported: false, permission: 'denied', needsInstallFirst: true,
    })).toBe('install');
  });

  it('offers to enable once the iOS app is installed', () => {
    expect(reminderOffer({ ...base, needsInstallFirst: false })).toBe('enable');
  });

  it('says nothing before the subscription check has run', () => {
    expect(reminderOffer({ ...base, ready: false })).toBeNull();
    // Even on iOS: a flash of the bar is worse than a beat of silence.
    expect(reminderOffer({ ...base, ready: false, needsInstallFirst: true })).toBeNull();
  });

  it('says nothing to someone already subscribed', () => {
    expect(reminderOffer({ ...base, subscribed: true })).toBeNull();
    expect(reminderOffer({ ...base, subscribed: true, needsInstallFirst: true })).toBeNull();
  });

  it('says nothing once dismissed, on any platform', () => {
    expect(reminderOffer({ ...base, dismissed: true })).toBeNull();
    expect(reminderOffer({ ...base, dismissed: true, needsInstallFirst: true })).toBeNull();
  });

  it('says nothing when notifications are blocked in the browser', () => {
    expect(reminderOffer({ ...base, permission: 'denied' })).toBeNull();
  });

  it('says nothing on a desktop browser with no push support', () => {
    expect(reminderOffer({ ...base, supported: false })).toBeNull();
  });
});
