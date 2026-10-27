interface DevelopmentOtp {
  code: string;
  expiresAt: number;
}

type DevelopmentOtpGlobal = typeof globalThis & {
  __sentinelDevelopmentOtpStore?: Map<string, DevelopmentOtp>;
};

const globalForOtp = globalThis as DevelopmentOtpGlobal;
const MAX_OTP_ENTRIES = 1_000;

function developmentOtpStore() {
  return (globalForOtp.__sentinelDevelopmentOtpStore ??= new Map());
}

function developmentConsoleEnabled() {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.EMAIL_PROVIDER === "console"
  );
}

export function storeDevelopmentOtp(
  challengeId: string,
  code: string,
  expiresAt: Date,
) {
  if (!developmentConsoleEnabled()) {
    throw new Error("Development OTP storage is only available with the console provider.");
  }

  const store = developmentOtpStore();
  const now = Date.now();
  for (const [id, otp] of store) {
    if (otp.expiresAt <= now) store.delete(id);
  }
  if (store.size >= MAX_OTP_ENTRIES && !store.has(challengeId)) {
    throw new Error("The local development OTP inbox is full.");
  }

  store.set(challengeId, { code, expiresAt: expiresAt.getTime() });
}

export function readDevelopmentOtp(challengeId: string): string | null {
  if (!developmentConsoleEnabled()) return null;

  const store = developmentOtpStore();
  const otp = store.get(challengeId);
  if (!otp) return null;
  if (otp.expiresAt <= Date.now()) {
    store.delete(challengeId);
    return null;
  }
  return otp.code;
}

export function removeDevelopmentOtp(challengeId: string) {
  developmentOtpStore().delete(challengeId);
}
