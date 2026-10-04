const KEY = "notas_token";

export function getToken() {
  return localStorage.getItem(KEY) || "";
}

export function setSession(token) {
  localStorage.setItem(KEY, token);
}

export function clearSession() {
  localStorage.removeItem(KEY);
}

export async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body) headers["Content-Type"] = "application/json";
  const res = await fetch(path, { ...options, headers });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Error de red");
  return data;
}
