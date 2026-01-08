export const FATAL_ERROR_OVERLAY_ID = 'fatal-error-overlay'

export function removeFatalErrorOverlay(): void {
  try {
    document.getElementById(FATAL_ERROR_OVERLAY_ID)?.remove()
  } catch {
    // best-effort cleanup only
  }
}
