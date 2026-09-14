import { api } from "./api";
import type { AuthResponse, Cliente, LoginPayload, RegistroPayload } from "../types/api";

export const AuthApi = {
  async registrar(payload: RegistroPayload): Promise<AuthResponse> {
    const { data } = await api.post<AuthResponse>("/auth/registro", payload);
    return data;
  },

  async login(payload: LoginPayload): Promise<AuthResponse> {
    const { data } = await api.post<AuthResponse>("/auth/login", payload);
    return data;
  },

  async perfil(): Promise<Cliente> {
    const { data } = await api.get<Cliente>("/clientes/me");
    return data;
  },
};
