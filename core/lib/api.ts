export const COURTLISTENER_BASE = "https://www.courtlistener.com/api/rest/v4";

export function getApiHeaders(): Record<string, string> {
  const key = process.env.COURTLISTENER_API_KEY;
  return key ? { Authorization: `Token ${key}` } : {};
}
