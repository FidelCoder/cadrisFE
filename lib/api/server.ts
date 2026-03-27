import { withApiBaseUrl } from "@/lib/api/base-url";

export async function serverApiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(withApiBaseUrl(path), {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}
