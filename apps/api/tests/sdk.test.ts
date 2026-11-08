import { afterEach, describe, it, expect } from "vitest";
import {
  firsttry,
  createMockSDK,
} from "../../../packages/mini-sdk/src/index.js";
afterEach(() => {
  globalThis.firsttryNative = undefined;
  globalThis.firsttryContext = undefined;
});
describe("SDK host boundary", () => {
  it("requires an explicit host instead of silently mocking analytics", async () => {
    await expect(firsttry.ready()).rejects.toThrow("Host context");
    await expect(firsttry.analytics.track("round_completed")).rejects.toThrow(
      "transport unavailable",
    );
  });
  it("keeps mock events local", async () => {
    const mock = createMockSDK();
    await mock.analytics.track("round_completed", { scoreBucket: "high" });
    expect(mock.mock).toBe(true);
    expect(mock.events).toHaveLength(1);
    expect(globalThis.firsttryNative).toBeUndefined();
  });
  it("passes only the constrained nonce-bound message and strips nonce from public context", async () => {
    const messages: string[] = [];
    globalThis.firsttryNative = { postMessage: (data) => messages.push(data) };
    globalThis.firsttryContext = {
      appId: "app",
      versionId: "v1",
      nonce: "test-nonce",
      theme: "light",
      locale: "en",
    };
    await firsttry.analytics.track("round_completed", {
      scoreBucket: "medium",
    });
    const message = JSON.parse(messages[0]);
    expect(message.method).toBe("analytics.track");
    expect(message.nonce).toBe("test-nonce");
    expect(message.token).toBeUndefined();
    expect(await firsttry.context()).not.toHaveProperty("nonce");
  });
});
