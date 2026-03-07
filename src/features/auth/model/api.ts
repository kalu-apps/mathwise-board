import { api } from "@/shared/api/client";
import type { User } from "@/entities/user/model/types";

export async function requestPasswordLogin(
  email: string,
  password: string
): Promise<User> {
  return api.post<User>(
    "/auth/password/login",
    { email, password },
    { notifyDataUpdate: false }
  );
}

export async function getAuthSession(): Promise<User | null> {
  return api.get<User | null>("/auth/session");
}

export async function logoutAuthSession(): Promise<void> {
  await api.post<{ ok: boolean }>(
    "/auth/logout",
    {},
    { notifyDataUpdate: false }
  );
}

export type PasswordStatusResponse = {
  ok: boolean;
  hasPassword: boolean;
  state: "none" | "active" | "reset_pending" | "locked_temp";
  lockedUntil: string | null;
  lastPasswordChangeAt: string | null;
};

export async function getPasswordStatus(): Promise<PasswordStatusResponse> {
  return api.get<PasswordStatusResponse>("/auth/password/status");
}
