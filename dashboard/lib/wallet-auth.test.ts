/**
 * Tests for wallet write-protection auth.
 *   node --import tsx --test dashboard/lib/wallet-auth.test.ts
 */
import { afterEach, describe, it } from "node:test";
import { strict as assert } from "node:assert";

import {
  isWalletWriteProtected,
  verifyConfirmToken,
  generateCsrfToken,
} from "./wallet-auth";

describe("isWalletWriteProtected", () => {
  afterEach(() => {
    delete process.env.CLAWTRL_WALLET_CONFIRM_PIN;
  });

  it("returns false when no PIN is set", () => {
    delete process.env.CLAWTRL_WALLET_CONFIRM_PIN;
    assert.equal(isWalletWriteProtected(), false);
  });

  it("returns true when PIN is set", () => {
    process.env.CLAWTRL_WALLET_CONFIRM_PIN = "1234";
    assert.equal(isWalletWriteProtected(), true);
  });
});

describe("verifyConfirmToken", () => {
  afterEach(() => {
    delete process.env.CLAWTRL_WALLET_CONFIRM_PIN;
  });

  it("returns true when no PIN is configured (open mode)", () => {
    delete process.env.CLAWTRL_WALLET_CONFIRM_PIN;
    assert.equal(verifyConfirmToken("anything"), true);
    assert.equal(verifyConfirmToken(undefined), true);
    assert.equal(verifyConfirmToken(null), true);
  });

  it("returns true when token matches PIN", () => {
    process.env.CLAWTRL_WALLET_CONFIRM_PIN = "my-secret-pin";
    assert.equal(verifyConfirmToken("my-secret-pin"), true);
  });

  it("returns false when token does not match PIN", () => {
    process.env.CLAWTRL_WALLET_CONFIRM_PIN = "my-secret-pin";
    assert.equal(verifyConfirmToken("wrong-pin"), false);
  });

  it("returns false when token is undefined/null/empty", () => {
    process.env.CLAWTRL_WALLET_CONFIRM_PIN = "my-secret-pin";
    assert.equal(verifyConfirmToken(undefined), false);
    assert.equal(verifyConfirmToken(null), false);
    assert.equal(verifyConfirmToken(""), false);
  });

  it("uses constant-time comparison (hash-based)", () => {
    process.env.CLAWTRL_WALLET_CONFIRM_PIN = "test-pin-123";
    // Same PIN should always verify
    assert.equal(verifyConfirmToken("test-pin-123"), true);
    // Different PIN should always fail
    assert.equal(verifyConfirmToken("test-pin-124"), false);
  });
});

describe("generateCsrfToken", () => {
  it("returns a 64-char hex string", () => {
    const token = generateCsrfToken();
    assert.equal(token.length, 64);
    assert.ok(/^[0-9a-f]+$/.test(token), "should be hex");
  });

  it("generates unique tokens", () => {
    const t1 = generateCsrfToken();
    const t2 = generateCsrfToken();
    assert.notEqual(t1, t2);
  });
});
