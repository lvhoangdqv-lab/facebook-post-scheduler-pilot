import test from "node:test";
import assert from "node:assert/strict";
import { verifyPasswordHash } from "../lib/edgeSecurity.mjs";

test("verifyPasswordHash accepts pbkdf2-sha256 hash and rejects wrong password", async () => {
  const hash = "pbkdf2-sha256$150000$twU_mSdnbEn5a-fGhTXCVQ$lJ4P5__Nj5cfZZfpdS69ivQLEULYGX0s5OEHZHg4iHI";
  assert.equal(await verifyPasswordHash("test-password", hash), true);
  assert.equal(await verifyPasswordHash("wrong-password", hash), false);
});
