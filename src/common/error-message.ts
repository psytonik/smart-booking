/** Message of a caught value, which in TypeScript's strict mode is `unknown`. */
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
