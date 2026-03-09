import { createContext, useContext } from "react";
import type { User } from "@/entities/user/model/types";

type AuthContextType = {
  user: User | null;
  isGuestSession: boolean;
  isAuthReady: boolean;
  loginWithPassword: (
    email: string,
    password: string
  ) => Promise<{ ok: boolean; error?: string }>;
  updateUser: (nextUser: User) => void;
  logout: () => void;
  isAuthModalOpen: boolean;
  openAuthModal: (initialEmail?: string) => void;
  closeAuthModal: () => void;
  authModalEmail: string;
};

export const AuthContext = createContext<AuthContextType>(
  {} as AuthContextType
);

export const useAuth = () => useContext(AuthContext);
