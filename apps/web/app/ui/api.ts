export async function api<T = any>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch("/api/v1" + path, {
    method,
    credentials: "include",
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      "x-firsttry-request": "1",
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Request failed");
  return data;
}
export type MiniApp = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  category: string;
  icon: string;
  color: string;
  creator: string;
  developer_id: string;
  version_id: string;
  semver: string;
  manifest: { estimatedDurationSeconds: number };
  status?: string;
};
