import assert from "node:assert/strict";
import test from "node:test";
import { readDevelopmentOtp } from "./dev-otp";
import { sendLoginOtp } from "./email";

function setEnvironmentVariable(key: string, value: string | undefined) {
  if (value === undefined) Reflect.deleteProperty(process.env, key);
  else Reflect.set(process.env, key, value);
}

test("console OTP delivery keeps codes and recipients out of logs and serves local verification", async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalProvider = process.env.EMAIL_PROVIDER;
  const originalInfo = console.info;
  let logCount = 0;
  setEnvironmentVariable("NODE_ENV", "development");
  setEnvironmentVariable("EMAIL_PROVIDER", "console");
  console.info = () => {
    logCount += 1;
  };

  const challengeId = "development-otp-test";
  const code = "123456";
  try {
    await sendLoginOtp("private-recipient@example.test", code, {
      challengeId,
      expiresAt: new Date(Date.now() + 60_000),
    });

    assert.equal(logCount, 0);
    assert.equal(readDevelopmentOtp(challengeId), code);
    assert.equal(
      readDevelopmentOtp("unknown-development-otp-test"),
      null,
    );
  } finally {
    console.info = originalInfo;
    setEnvironmentVariable("NODE_ENV", originalNodeEnv);
    setEnvironmentVariable("EMAIL_PROVIDER", originalProvider);
  }
});

test("development OTPs expire and are not retrievable in production", async () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalProvider = process.env.EMAIL_PROVIDER;
  setEnvironmentVariable("NODE_ENV", "development");
  setEnvironmentVariable("EMAIL_PROVIDER", "console");

  try {
    await sendLoginOtp("private-recipient@example.test", "654321", {
      challengeId: "expired-development-otp-test",
      expiresAt: new Date(Date.now() - 1),
    });
    assert.equal(readDevelopmentOtp("expired-development-otp-test"), null);

    setEnvironmentVariable("NODE_ENV", "production");
    assert.equal(readDevelopmentOtp("expired-development-otp-test"), null);
    await assert.rejects(
      sendLoginOtp("private-recipient@example.test", "654321", {
        challengeId: "production-otp-test",
        expiresAt: new Date(Date.now() + 60_000),
      }),
    );
  } finally {
    setEnvironmentVariable("NODE_ENV", originalNodeEnv);
    setEnvironmentVariable("EMAIL_PROVIDER", originalProvider);
  }
});
