import { useState } from "react";
import Modal from "./Modal";

export default function TextPromptDialog({
  title,
  eyebrow,
  description,
  label,
  initialValue = "",
  placeholder = "",
  submitLabel = "Save",
  maxLength = 80,
  onSubmit,
  onClose,
}) {
  const [value, setValue] = useState(initialValue);
  const trimmed = value.trim();

  return (
    <Modal
      title={title}
      eyebrow={eyebrow}
      description={description}
      onClose={onClose}
      width="small"
    >
      <form
        className="text-dialog"
        onSubmit={(event) => {
          event.preventDefault();
          if (!trimmed) return;
          onSubmit(trimmed);
        }}
      >
        <label className="field-label" htmlFor="text-prompt-value">
          {label}
        </label>
        <input
          id="text-prompt-value"
          className="text-field"
          type="text"
          value={value}
          maxLength={maxLength}
          placeholder={placeholder}
          onChange={(event) => setValue(event.target.value)}
          data-autofocus
        />
        <div className="dialog-actions">
          <button className="dialog-button" type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="dialog-button dialog-button-primary"
            type="submit"
            disabled={!trimmed}
          >
            {submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}
