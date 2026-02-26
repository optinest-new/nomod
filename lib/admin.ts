import crypto from "node:crypto";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { readSupabaseJson, supabaseRequest } from "@/lib/supabase";

export type AdminRole = "admin" | "editor";

type StoredAdminUser = {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  passwordHash: string;
  passwordSalt: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
};

type StoredAdminSession = {
  id: string;
  tokenHash: string;
  userId: string;
  role: AdminRole;
  createdAt: string;
  expiresAt: string;
  lastSeenAt: string;
  userAgent?: string;
};

type AdminUserRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  password_hash: string;
  password_salt: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_login_at?: string | null;
};

type AdminSessionRow = {
  id: string;
  token_hash: string;
  user_id: string;
  role: string;
  created_at: string;
  expires_at: string;
  last_seen_at: string;
  user_agent?: string | null;
};

export type AuthenticatedAdminUser = {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
};

export const ADMIN_COOKIE_NAME = "nomod_admin_session";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;
const DEFAULT_ADMIN_EMAIL = "admin@nomod.local";
const DEFAULT_ADMIN_PASSWORD = "nomod-admin";
const DEFAULT_ADMIN_NAME = "Site Admin";

function getAuthSecret(): string {
  const secret = process.env.NOMOD_AUTH_SECRET?.trim();
  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("NOMOD_AUTH_SECRET must be set in production.");
  }

  return process.env.NOMOD_ADMIN_PASSWORD ?? "nomod-dev-auth-secret";
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function sanitizeRole(value: string): AdminRole {
  return value === "admin" ? "admin" : "editor";
}

function toPublicUser(user: StoredAdminUser): AuthenticatedAdminUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastLoginAt: user.lastLoginAt,
  };
}

function toStoredUser(row: AdminUserRow): StoredAdminUser | null {
  if (!row.id || !row.email || !row.name || !row.password_hash || !row.password_salt) {
    return null;
  }

  return {
    id: row.id,
    email: normalizeEmail(row.email),
    name: row.name,
    role: sanitizeRole(row.role),
    passwordHash: row.password_hash,
    passwordSalt: row.password_salt,
    isActive: row.is_active !== false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLoginAt: row.last_login_at ?? undefined,
  };
}

function toStoredSession(row: AdminSessionRow): StoredAdminSession | null {
  if (!row.id || !row.token_hash || !row.user_id || !row.created_at || !row.expires_at) {
    return null;
  }

  return {
    id: row.id,
    tokenHash: row.token_hash,
    userId: row.user_id,
    role: sanitizeRole(row.role),
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    lastSeenAt: row.last_seen_at,
    userAgent: row.user_agent ?? undefined,
  };
}

function hashPassword(password: string, salt = crypto.randomBytes(16).toString("hex")) {
  const passwordHash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { passwordHash, passwordSalt: salt };
}

function verifyPassword(plainTextPassword: string, user: StoredAdminUser): boolean {
  try {
    const candidateHash = crypto.scryptSync(plainTextPassword, user.passwordSalt, 64);
    const storedHash = Buffer.from(user.passwordHash, "hex");

    if (candidateHash.length !== storedHash.length) {
      return false;
    }

    return crypto.timingSafeEqual(candidateHash, storedHash);
  } catch {
    return false;
  }
}

function hashSessionToken(token: string): string {
  return crypto.createHmac("sha256", getAuthSecret()).update(token).digest("hex");
}

function createDefaultAdminUser(): StoredAdminUser {
  const now = new Date().toISOString();
  const email = normalizeEmail(process.env.NOMOD_ADMIN_EMAIL ?? DEFAULT_ADMIN_EMAIL);
  const password = process.env.NOMOD_ADMIN_PASSWORD ?? DEFAULT_ADMIN_PASSWORD;
  const hashed = hashPassword(password);

  return {
    id: crypto.randomUUID(),
    email,
    name: DEFAULT_ADMIN_NAME,
    role: "admin",
    passwordHash: hashed.passwordHash,
    passwordSalt: hashed.passwordSalt,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
}

async function fetchUsers(): Promise<StoredAdminUser[]> {
  const response = await supabaseRequest("/rest/v1/admin_users", {
    query: {
      select:
        "id,email,name,role,password_hash,password_salt,is_active,created_at,updated_at,last_login_at",
      order: "created_at.asc",
    },
  });

  const rows = await readSupabaseJson<AdminUserRow[]>(response);
  return rows
    .map((row) => toStoredUser(row))
    .filter((row): row is StoredAdminUser => Boolean(row));
}

async function ensureDefaultAdminUser(): Promise<void> {
  const existing = await fetchUsers();
  if (existing.length > 0) {
    return;
  }

  const user = createDefaultAdminUser();
  const response = await supabaseRequest("/rest/v1/admin_users", {
    method: "POST",
    query: {
      on_conflict: "email",
    },
    prefer: "resolution=ignore-duplicates,return=minimal",
    body: [
      {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        password_hash: user.passwordHash,
        password_salt: user.passwordSalt,
        is_active: true,
        created_at: user.createdAt,
        updated_at: user.updatedAt,
      },
    ],
  });

  await readSupabaseJson(response);
}

async function readUsers(): Promise<StoredAdminUser[]> {
  await ensureDefaultAdminUser();
  return fetchUsers();
}

async function fetchSessions(): Promise<StoredAdminSession[]> {
  const nowIso = new Date().toISOString();
  const response = await supabaseRequest("/rest/v1/admin_sessions", {
    query: {
      select: "id,token_hash,user_id,role,created_at,expires_at,last_seen_at,user_agent",
      expires_at: `gt.${nowIso}`,
      order: "created_at.asc",
    },
  });

  const rows = await readSupabaseJson<AdminSessionRow[]>(response);
  return rows
    .map((row) => toStoredSession(row))
    .filter((row): row is StoredAdminSession => Boolean(row));
}

async function deleteSessionById(sessionId: string): Promise<void> {
  const response = await supabaseRequest("/rest/v1/admin_sessions", {
    method: "DELETE",
    query: {
      id: `eq.${sessionId}`,
    },
  });

  await readSupabaseJson(response);
}

async function removeExpiredOrMissingUserSessions(): Promise<void> {
  const [users, sessions] = await Promise.all([readUsers(), fetchSessions()]);
  const userIds = new Set(users.filter((user) => user.isActive).map((user) => user.id));

  for (const session of sessions) {
    if (userIds.has(session.userId)) {
      continue;
    }

    await deleteSessionById(session.id);
  }
}

export function hasCustomAdminCredentials(): boolean {
  return Boolean(process.env.NOMOD_ADMIN_EMAIL || process.env.NOMOD_ADMIN_PASSWORD);
}

export function getDefaultAdminCredentials(): { email: string; password: string } {
  return {
    email: DEFAULT_ADMIN_EMAIL,
    password: DEFAULT_ADMIN_PASSWORD,
  };
}

export async function authenticateAdminUser(
  emailInput: string,
  password: string,
): Promise<AuthenticatedAdminUser | null> {
  const email = normalizeEmail(emailInput);
  const users = await readUsers();
  const matching = users.find((user) => user.email === email && user.isActive);

  if (!matching) {
    return null;
  }

  if (!verifyPassword(password, matching)) {
    return null;
  }

  const now = new Date().toISOString();
  const updateResponse = await supabaseRequest("/rest/v1/admin_users", {
    method: "PATCH",
    query: {
      id: `eq.${matching.id}`,
    },
    body: {
      last_login_at: now,
      updated_at: now,
    },
  });
  await readSupabaseJson(updateResponse);

  return {
    ...toPublicUser(matching),
    lastLoginAt: now,
    updatedAt: now,
  };
}

export async function setAdminSession(user: AuthenticatedAdminUser): Promise<void> {
  await removeExpiredOrMissingUserSessions();
  const sessions = await fetchSessions();

  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashSessionToken(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_MAX_AGE_SECONDS * 1000).toISOString();
  const headerStore = await headers();

  const userSessions = sessions.filter((item) => item.userId === user.id);
  const otherSessions = sessions.filter((item) => item.userId !== user.id);
  const staleUserSessions = userSessions
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .slice(0, Math.max(0, userSessions.length - 19));

  const allSorted = [...otherSessions, ...userSessions].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  const staleGlobal = allSorted.slice(0, Math.max(0, allSorted.length - 4999));

  const staleIds = new Set<string>([...staleUserSessions, ...staleGlobal].map((session) => session.id));

  for (const sessionId of staleIds) {
    await deleteSessionById(sessionId);
  }

  const insertResponse = await supabaseRequest("/rest/v1/admin_sessions", {
    method: "POST",
    prefer: "return=minimal",
    body: [
      {
        token_hash: tokenHash,
        user_id: user.id,
        role: user.role,
        created_at: now.toISOString(),
        expires_at: expiresAt,
        last_seen_at: now.toISOString(),
        user_agent: headerStore.get("user-agent") ?? null,
      },
    ],
  });

  await readSupabaseJson(insertResponse);

  const cookieStore = await cookies();
  cookieStore.set({
    name: ADMIN_COOKIE_NAME,
    value: token,
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;

  if (token) {
    const tokenHash = hashSessionToken(token);
    const deleteResponse = await supabaseRequest("/rest/v1/admin_sessions", {
      method: "DELETE",
      query: {
        token_hash: `eq.${tokenHash}`,
      },
    });
    await readSupabaseJson(deleteResponse);
  }

  cookieStore.delete(ADMIN_COOKIE_NAME);
}

export async function getCurrentAdminUser(): Promise<AuthenticatedAdminUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  await removeExpiredOrMissingUserSessions();

  const tokenHash = hashSessionToken(token);
  const sessionResponse = await supabaseRequest("/rest/v1/admin_sessions", {
    query: {
      select: "id,token_hash,user_id,role,created_at,expires_at,last_seen_at,user_agent",
      token_hash: `eq.${tokenHash}`,
      limit: "1",
    },
  });

  const sessionRows = await readSupabaseJson<AdminSessionRow[]>(sessionResponse);
  const session = sessionRows.map((row) => toStoredSession(row)).find(Boolean);

  if (!session) {
    return null;
  }

  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    await deleteSessionById(session.id);
    return null;
  }

  const users = await readUsers();
  const user = users.find((item) => item.id === session.userId && item.isActive);

  if (!user) {
    return null;
  }

  return toPublicUser(user);
}

export async function isAdminSession(roles: AdminRole[] = ["admin", "editor"]): Promise<boolean> {
  const user = await getCurrentAdminUser();
  if (!user) {
    return false;
  }

  return roles.includes(user.role);
}

export async function requireAdminSession(
  roles: AdminRole[] = ["admin", "editor"],
): Promise<AuthenticatedAdminUser> {
  const user = await getCurrentAdminUser();

  if (!user) {
    redirect("/admin/login");
  }

  if (!roles.includes(user.role)) {
    redirect("/admin?error=You are not allowed to access this page.");
  }

  return user;
}

export async function listAdminUsers(): Promise<AuthenticatedAdminUser[]> {
  const users = await readUsers();
  return users
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((user) => toPublicUser(user));
}

export async function createAdminUser(input: {
  email: string;
  name: string;
  password: string;
  role: AdminRole;
}): Promise<AuthenticatedAdminUser> {
  const email = normalizeEmail(input.email);
  const name = input.name.trim();
  const password = input.password;

  if (!email || !name) {
    throw new Error("Name and email are required.");
  }

  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }

  const users = await readUsers();
  if (users.some((user) => user.email === email)) {
    throw new Error("A user with this email already exists.");
  }

  const now = new Date().toISOString();
  const hashed = hashPassword(password);
  const userId = crypto.randomUUID();

  const insertResponse = await supabaseRequest("/rest/v1/admin_users", {
    method: "POST",
    prefer: "return=minimal",
    body: [
      {
        id: userId,
        email,
        name,
        role: input.role,
        password_hash: hashed.passwordHash,
        password_salt: hashed.passwordSalt,
        is_active: true,
        created_at: now,
        updated_at: now,
      },
    ],
  });
  await readSupabaseJson(insertResponse);

  return {
    id: userId,
    email,
    name,
    role: input.role,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
}

export async function updateAdminUserRole(userId: string, role: AdminRole): Promise<void> {
  const users = await readUsers();
  const target = users.find((user) => user.id === userId && user.isActive);

  if (!target) {
    throw new Error("User not found.");
  }

  if (target.role === "admin" && role !== "admin") {
    const activeAdminCount = users.filter((user) => user.isActive && user.role === "admin").length;
    if (activeAdminCount <= 1) {
      throw new Error("At least one admin user must remain.");
    }
  }

  const now = new Date().toISOString();
  const updateResponse = await supabaseRequest("/rest/v1/admin_users", {
    method: "PATCH",
    query: {
      id: `eq.${userId}`,
    },
    body: {
      role,
      updated_at: now,
    },
  });
  await readSupabaseJson(updateResponse);

  const sessionsUpdateResponse = await supabaseRequest("/rest/v1/admin_sessions", {
    method: "PATCH",
    query: {
      user_id: `eq.${userId}`,
    },
    body: {
      role,
      last_seen_at: now,
    },
  });
  await readSupabaseJson(sessionsUpdateResponse);
}

export async function updateAdminUserPassword(
  userId: string,
  newPassword: string,
): Promise<void> {
  const password = newPassword.trim();

  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }

  const users = await readUsers();
  const target = users.find((user) => user.id === userId && user.isActive);

  if (!target) {
    throw new Error("User not found.");
  }

  const now = new Date().toISOString();
  const hashed = hashPassword(password);

  const updateResponse = await supabaseRequest("/rest/v1/admin_users", {
    method: "PATCH",
    query: {
      id: `eq.${userId}`,
    },
    body: {
      password_hash: hashed.passwordHash,
      password_salt: hashed.passwordSalt,
      updated_at: now,
    },
  });

  await readSupabaseJson(updateResponse);
}

export async function deleteAdminUser(userId: string): Promise<void> {
  const users = await readUsers();
  const target = users.find((user) => user.id === userId && user.isActive);

  if (!target) {
    throw new Error("User not found.");
  }

  if (target.role === "admin") {
    const activeAdminCount = users.filter((user) => user.isActive && user.role === "admin").length;
    if (activeAdminCount <= 1) {
      throw new Error("At least one admin user must remain.");
    }
  }

  const deleteResponse = await supabaseRequest("/rest/v1/admin_users", {
    method: "DELETE",
    query: {
      id: `eq.${userId}`,
    },
  });

  await readSupabaseJson(deleteResponse);
}
