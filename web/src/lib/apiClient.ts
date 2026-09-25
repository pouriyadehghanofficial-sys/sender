import { getToken, clearToken } from "./auth";
import type { components } from "../types/openapi";

// در dev از طریق پروکسی Vite (vite.config.ts) به http://localhost:3000 می‌رود؛
// در production همان دامنه‌ای که فایل‌های استاتیک از آن سرو می‌شوند (build زیر /app سرو می‌شود).
let API_BASE = "/api/v1";

/** فقط برای تست‌های خودکار (Node، بدون مرورگر) — در کد production هرگز صدا زده نمی‌شود */
export function __setApiBaseForTests(base: string) {
  API_BASE = base;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** وقتی سرور ۴۰۱ بدهد (توکن منقضی/باطل)، همه‌ی صفحات باز باید بلافاصله باخبر شوند */
type UnauthorizedListener = () => void;
let onUnauthorized: UnauthorizedListener | null = null;
export function setUnauthorizedHandler(fn: UnauthorizedListener | null) {
  onUnauthorized = fn;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  /** برای آپلود فایل (FormData) — Content-Type خودکار توسط مرورگر تنظیم می‌شود */
  formData?: FormData;
  /** برای endpoint هایی مثل /auth/login که نیازی به توکن ندارند */
  skipAuth?: boolean;
  query?: Record<string, string | number | undefined>;
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  let url = API_BASE + path;
  if (query) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== "") params.set(key, String(value));
    }
    const qs = params.toString();
    if (qs) url += "?" + qs;
  }
  return url;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (!options.skipAuth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  let body: BodyInit | undefined;
  if (options.formData) {
    body = options.formData; // مرورگر خودش Content-Type چندبخشی درست را می‌سازد
  } else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  const res = await fetch(buildUrl(path, options.query), {
    method: options.method ?? "GET",
    headers,
    body,
  });

  if (res.status === 401 && !options.skipAuth) {
    clearToken();
    onUnauthorized?.();
  }

  if (res.status === 204) {
    return undefined as T;
  }

  let data: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    const message = (data as { error?: string })?.error || `خطای غیرمنتظره (کد ${res.status})`;
    throw new ApiError(res.status, message);
  }

  return data as T;
}

// ---------------------------------------------------------------------------
// انواع کمکی از schema های تولیدشده‌ی OpenAPI (منبع واحد حقیقت)
// ---------------------------------------------------------------------------
export type SchemaUser = components["schemas"]["User"];
export type SchemaApiKey = components["schemas"]["ApiKey"];
export type SchemaApiKeyCreated = components["schemas"]["ApiKeyCreated"];
export type SchemaProduct = components["schemas"]["Product"];
export type SchemaCampaign = components["schemas"]["Campaign"];
export type SchemaConversation = components["schemas"]["Conversation"];
export type SchemaWaitingConversation = components["schemas"]["WaitingConversation"];
export type SchemaOrder = components["schemas"]["Order"];
export type SchemaReferral = components["schemas"]["Referral"];
export type SchemaImportResult = components["schemas"]["ImportResult"];
export type SchemaDashboardSummary = components["schemas"]["DashboardSummary"];
export type SchemaDashboardStatistics = components["schemas"]["DashboardStatistics"];
export type SchemaAdminApiKeySummary = components["schemas"]["AdminApiKeySummary"];
export type SchemaPaginatedAdminActivity = components["schemas"]["PaginatedAdminActivity"];

// ---------------------------------------------------------------------------
// auth
// ---------------------------------------------------------------------------
export const authApi = {
  register: (email: string, password: string) =>
    request<{ token: string; user: SchemaUser }>("/auth/register", { method: "POST", body: { email, password }, skipAuth: true }),
  login: (email: string, password: string) =>
    request<{ token: string; user: SchemaUser }>("/auth/login", { method: "POST", body: { email, password }, skipAuth: true }),
};

// ---------------------------------------------------------------------------
// api-keys
// ---------------------------------------------------------------------------
export const apiKeysApi = {
  list: () => request<{ data: SchemaApiKey[] }>("/api-keys"),
  create: (name: string) => request<SchemaApiKeyCreated>("/api-keys", { method: "POST", body: { name } }),
  revoke: (id: string) => request<void>(`/api-keys/${id}`, { method: "DELETE" }),
};

// ---------------------------------------------------------------------------
// products
// ---------------------------------------------------------------------------
export const productsApi = {
  list: () => request<{ data: SchemaProduct[] }>("/products"),
  get: (id: string) => request<{ product: SchemaProduct }>(`/products/${id}`),
  create: (input: { name: string; shortCode?: string; descriptionText: string }) =>
    request<{ product: SchemaProduct }>("/products", { method: "POST", body: input }),
  update: (id: string, input: Partial<{ name: string; descriptionText: string; isActive: boolean }>) =>
    request<{ product: SchemaProduct }>(`/products/${id}`, { method: "PATCH", body: input }),
};

// ---------------------------------------------------------------------------
// contacts
// ---------------------------------------------------------------------------
export const contactsApi = {
  import: (file: File, opts?: { productId?: string }) => {
    const form = new FormData();
    form.append("file", file);
    if (opts?.productId) form.append("productId", opts.productId);
    return request<SchemaImportResult>("/contacts/import", { method: "POST", formData: form });
  },
};

// ---------------------------------------------------------------------------
// campaigns
// ---------------------------------------------------------------------------
export const campaignsApi = {
  list: () => request<{ data: SchemaCampaign[] }>("/campaigns"),
  get: (id: string) => request<{ campaign: SchemaCampaign }>(`/campaigns/${id}`),
  create: (input: { productId: string; name?: string }) =>
    request<{ campaign: SchemaCampaign }>("/campaigns", { method: "POST", body: input }),
  start: (id: string) => request<{ message: string }>(`/campaigns/${id}/start`, { method: "POST" }),
  pause: (id: string) => request<{ message: string }>(`/campaigns/${id}/pause`, { method: "POST" }),
  resume: (id: string) => request<{ message: string }>(`/campaigns/${id}/resume`, { method: "POST" }),
  cancel: (id: string) => request<{ message: string }>(`/campaigns/${id}/cancel`, { method: "POST" }),
};

// ---------------------------------------------------------------------------
// conversations
// ---------------------------------------------------------------------------
export const conversationsApi = {
  active: () => request<{ data: SchemaConversation[] }>("/conversations/active"),
  waiting: () => request<{ data: SchemaWaitingConversation[] }>("/conversations/waiting"),
  get: (id: string) => request<{ conversation: SchemaConversation }>(`/conversations/${id}`),
  reply: (id: string, text: string) => request<{ ok: boolean }>(`/conversations/${id}/reply`, { method: "POST", body: { text } }),
  resolve: (id: string) => request<{ conversation: SchemaConversation }>(`/conversations/${id}/resolve`, { method: "POST" }),
};

// ---------------------------------------------------------------------------
// orders
// ---------------------------------------------------------------------------
export const ordersApi = {
  list: () => request<{ data: SchemaOrder[]; summary: { completed: number; active: number; cancelled: number } }>("/orders"),
  get: (id: string) => request<{ order: SchemaOrder }>(`/orders/${id}`),
};

// ---------------------------------------------------------------------------
// referrals
// ---------------------------------------------------------------------------
export const referralsApi = {
  list: () => request<{ data: SchemaReferral[] }>("/referrals"),
};

// ---------------------------------------------------------------------------
// dashboard
// ---------------------------------------------------------------------------
export const dashboardApi = {
  summary: () => request<SchemaDashboardSummary>("/dashboard/summary"),
  statistics: () => request<SchemaDashboardStatistics>("/dashboard/statistics"),
};

// ---------------------------------------------------------------------------
// admin (فقط owner)
// ---------------------------------------------------------------------------
export const adminApi = {
  users: () => request<{ data: SchemaUser[] }>("/admin/users"),
  apiKeys: () => request<{ data: SchemaAdminApiKeySummary[] }>("/admin/api-keys"),
  activity: (params?: { userId?: string; apiKeyId?: string; page?: number; pageSize?: number }) =>
    request<SchemaPaginatedAdminActivity>("/admin/activity", { query: params }),
};
