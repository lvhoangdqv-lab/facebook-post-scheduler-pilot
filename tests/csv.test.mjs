import test from "node:test";
import assert from "node:assert/strict";
import { parseCsv, toCsv } from "../lib/csv.mjs";

test("parseCsv handles quoted commas", () => {
  const rows = parseCsv('caption,scheduledAt\n"Hello, Page","2026-05-12T09:00"\n');
  assert.deepEqual(rows, [{ caption: "Hello, Page", scheduledAt: "2026-05-12T09:00" }]);
});

test("toCsv escapes quotes", () => {
  const csv = toCsv([{ id: "1", caption: 'Say "hi"', status: "draft" }]);
  assert.match(csv, /"Say ""hi"""/);
});
