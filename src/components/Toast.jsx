import { AlertCircle, Check, RotateCcw, Trash2, X } from "lucide-react";
import { useEffect } from "react";

export default function Toast({ toast, onUndo, onDismiss }) {
  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(onDismiss, 6000);
    return () => window.clearTimeout(timer);
  }, [toast, onDismiss]);

  if (!toast) return null;

  const isDelete = toast.kind === "deleted";
  const isError = toast.kind === "error";

  return (
    <div className="toast" role="status" aria-live="polite">
      <span
        className={`toast-icon ${isDelete ? "toast-icon-delete" : ""} ${
          isError ? "toast-icon-error" : ""
        }`}
      >
        {isDelete ? (
          <Trash2 size={15} />
        ) : isError ? (
          <AlertCircle size={15} />
        ) : (
          <Check size={15} strokeWidth={2.5} />
        )}
      </span>
      <span className="toast-message">{toast.message}</span>
      {isDelete && (
        <button className="toast-action" type="button" onClick={onUndo}>
          <RotateCcw size={13} />
          Undo
        </button>
      )}
      <button className="toast-close" type="button" onClick={onDismiss} aria-label="Dismiss message">
        <X size={14} />
      </button>
    </div>
  );
}
