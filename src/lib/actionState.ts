// Shared shape for server actions that surface an inline error to the
// client via useActionState instead of throwing (which would crash the
// page with an opaque "server-side exception" digest in production).

export type SaveState = { ok: boolean; error: string | null };

export const SAVE_STATE_INITIAL: SaveState = { ok: true, error: null };

export function toErrorState(err: unknown): SaveState {
  return {
    ok: false,
    error: err instanceof Error ? err.message : "Something went wrong",
  };
}
