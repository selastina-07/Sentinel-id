import assert from "node:assert/strict";
import test from "node:test";
import {
  ownedActiveSessionWhere,
  ownedActiveTrustedDeviceWhere,
} from "./authorization";
import { assessLoginRisk, decideOtp, initialThemeAt, themeForLogin } from "./rules";

test("IST theme boundary is light from 05:00 inclusive to 12:00 exclusive", () => {
  assert.equal(initialThemeAt(new Date("2026-10-21T23:29:59.999Z")), "DARK");
  assert.equal(initialThemeAt(new Date("2026-10-21T23:30:00.000Z")), "LIGHT");
  assert.equal(initialThemeAt(new Date("2026-10-22T06:29:59.999Z")), "LIGHT");
  assert.equal(initialThemeAt(new Date("2026-10-22T06:30:00.000Z")), "DARK");
});

test("manual theme preference persists across subsequent sign-ins", () => {
  const beforeWindow = new Date("2026-10-21T20:00:00.000Z");
  assert.equal(themeForLogin(true, "LIGHT", beforeWindow), "LIGHT");
  assert.equal(themeForLogin(false, "LIGHT", beforeWindow), "DARK");
});

test("login risk requires a challenge for a new device, changed IP, or expired trust", () => {
  const now = new Date("2026-10-22T12:00:00Z");
  const device = {
    ipAddress: "203.0.113.1",
    browser: "Chrome 120",
    operatingSystem: "Windows 11",
    deviceCategory: "Desktop",
    city: "Mumbai",
    region: "Maharashtra",
    expiresAt: new Date("2026-11-22T12:00:00Z"),
    revokedAt: null,
  };
  assert.deepEqual(
    assessLoginRisk({ ...device, city: "Mumbai", region: "Maharashtra" }, null, now),
    ["new_device"],
  );
  assert.deepEqual(
    assessLoginRisk({ ...device, ipAddress: "203.0.113.2" }, device, now),
    ["ip_changed"],
  );
  assert.deepEqual(
    assessLoginRisk({ ...device, ipAddress: "203.0.113.1" }, { ...device, expiresAt: now }, now),
    ["new_device"],
  );
});

test("location and browser changes are checked only against known device metadata", () => {
  const now = new Date("2026-10-22T12:00:00Z");
  const trusted = {
    ipAddress: null,
    browser: "Chrome 120",
    operatingSystem: "Windows 11",
    deviceCategory: "Desktop",
    city: "Mumbai",
    region: "Maharashtra",
    expiresAt: new Date("2026-11-22T12:00:00Z"),
    revokedAt: null,
  };
  assert.deepEqual(
    assessLoginRisk({ ...trusted, city: null, region: null }, trusted, now),
    [],
  );
  assert.deepEqual(
    assessLoginRisk(
      { ...trusted, browser: "Firefox 130", city: "Pune", region: "Maharashtra" },
      trusted,
      now,
    ),
    ["browser_changed", "location_changed"],
  );
});

test("OTP decisions enforce expiry, one-time use, and failed-attempt limits", () => {
  const now = new Date("2026-10-22T12:00:00Z");
  const active = {
    expiresAt: new Date("2026-10-22T12:10:00Z"),
    consumedAt: null,
    attempts: 0,
  };
  assert.equal(decideOtp(active, true, 5, now), "verified");
  assert.equal(
    decideOtp({ ...active, consumedAt: now }, true, 5, now),
    "consumed",
  );
  assert.equal(
    decideOtp({ ...active, expiresAt: now }, true, 5, now),
    "expired",
  );
  assert.equal(decideOtp({ ...active, attempts: 4 }, false, 5, now), "incorrect");
  assert.equal(decideOtp({ ...active, attempts: 5 }, true, 5, now), "locked");
});

test("session revocation is constrained to the owner's active, unexpired session", () => {
  const now = new Date("2026-10-22T12:00:00Z");
  assert.deepEqual(ownedActiveSessionWhere("owner-a", "session-a", now), {
    userId: "owner-a",
    id: "session-a",
    revokedAt: null,
    expiresAt: { gt: now },
  });
});

test("trusted-device revocation is constrained to the owning user and active device", () => {
  assert.deepEqual(ownedActiveTrustedDeviceWhere("owner-a", "device-a"), {
    userId: "owner-a",
    id: "device-a",
    revokedAt: null,
  });
});
