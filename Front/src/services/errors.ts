import { AxiosError } from "axios";
import type { ApiErrorBody } from "../types/api";

export function mensajeError(error: unknown, fallback = "Ocurrió un error"): string {
  if (error instanceof AxiosError) {
    const body = error.response?.data as ApiErrorBody | undefined;
    return body?.error ?? fallback;
  }
  return fallback;
}
