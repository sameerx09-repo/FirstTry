type Context = {
  appId: string;
  versionId: string;
  nonce: string;
  theme: "light" | "dark";
  locale: string;
};
declare global {
  var firsttryNative: { postMessage: (data: string) => void } | undefined;
  var firsttryContext: Context | undefined;
}
function send(method: string, extra: Record<string, unknown> = {}) {
  const c = globalThis.firsttryContext;
  if (!globalThis.firsttryNative || !c)
    throw new Error(
      "SDK host transport unavailable. Use createMockSDK explicitly in browser development.",
    );
  globalThis.firsttryNative.postMessage(
    JSON.stringify({ method, nonce: c.nonce, ...extra }),
  );
}
export const firsttry = {
  async ready() {
    if (!globalThis.firsttryContext)
      throw new Error("Host context unavailable");
  },
  async context() {
    if (!globalThis.firsttryContext)
      throw new Error("Host context unavailable");
    const { nonce, ...context } = globalThis.firsttryContext;
    return context;
  },
  analytics: {
    async track(
      name: "ready" | "round_completed" | "task_completed",
      props: Record<string, number | boolean | "low" | "medium" | "high"> = {},
    ) {
      send("analytics.track", { id: crypto.randomUUID(), name, props });
    },
  },
  feedback: {
    async prompt() {
      send("feedback.prompt");
    },
  },
  ui: {
    async close() {
      send("ui.close");
    },
  },
};
export function createMockSDK() {
  const events: unknown[] = [];
  return {
    mock: true,
    events,
    async ready() {},
    async context() {
      return { appId: "MOCK", versionId: "MOCK", theme: "light", locale: "en" };
    },
    analytics: {
      async track(name: string, props: unknown = {}) {
        events.push({ name, props });
      },
    },
    feedback: {
      async prompt() {
        events.push({ mock: "feedback" });
      },
    },
    ui: {
      async close() {
        events.push({ mock: "close" });
      },
    },
  };
}
