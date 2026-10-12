import crypto from "crypto";

export function generarApiKey(): string {
  return crypto.randomBytes(24).toString("hex");
}

export function hashApiKey(apiKey: string): string {
  return crypto.createHash("sha256").update(apiKey).digest("hex");
}
