import { AlertTriangle, Trash2 } from "lucide-react";
import Modal from "./Modal";

export default function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "danger",
  icon = "warning",
  onConfirm,
  onClose,
}) {
  const Icon = icon === "trash" ? Trash2 : AlertTriangle;

  return (
    <Modal title={title} onClose={onClose} width="small" className="confirm-dialog">
      <div className={`confirm-message confirm-message-${tone}`}>
        <span className="confirm-icon">
          <Icon size={20} />
        </span>
        <p>{message}</p>
      </div>
      <div className="dialog-actions">
        <button
          className="dialog-button"
          type="button"
          onClick={onClose}
          data-autofocus
        >
          {cancelLabel}
        </button>
        <button
          className={`dialog-button ${tone === "danger" ? "dialog-button-danger" : "dialog-button-primary"}`}
          type="button"
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
