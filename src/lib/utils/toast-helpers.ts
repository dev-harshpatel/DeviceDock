import { toast } from "sonner";
import { TOAST_MESSAGES } from "@/lib/constants/toast-messages";

/**
 * Display a toast error, extracting the message from an unknown error value.
 * Falls back to the provided fallback string, or the generic error message.
 */
export function toastError(error: unknown, fallback?: string): void {
  const message =
    error instanceof Error ? error.message : (fallback ?? TOAST_MESSAGES.ERROR_GENERIC);
  toast.error(message);
}
