import { useState } from "react";
import { Folder, FolderPlus } from "lucide-react";
import { getFolderPath } from "../lib/folders";
import Modal from "./Modal";

export default function FolderDialog({
  mode = "create",
  folder = null,
  parentId = null,
  folders,
  onSubmit,
  onClose,
}) {
  const [name, setName] = useState(folder?.name ?? "");
  const targetParentId = folder?.parentId ?? parentId ?? null;
  const parentPath = getFolderPath(folders, targetParentId);
  const isRename = mode === "rename";

  const submit = (event) => {
    event.preventDefault();
    const clean = name.trim();
    if (!clean) return;
    onSubmit(clean);
  };

  return (
    <Modal
      title={isRename ? "Rename folder" : parentPath.length ? "New subfolder" : "New folder"}
      eyebrow="Organise your notes"
      description={
        isRename
          ? "Give this folder a clearer name. Notes inside it will not move."
          : "Folders can contain notes and other folders."
      }
      onClose={onClose}
      width="small"
    >
      <form className="dialog-form" onSubmit={submit}>
        <label className="field-label" htmlFor="folder-name">
          Folder name
        </label>
        <input
          id="folder-name"
          className="text-field dialog-input"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Study notes"
          maxLength={80}
          data-autofocus
        />
        <div className="folder-parent-note">
          <Folder size={15} />
          <span>
            {parentPath.length > 0 ? (
              <>
                Inside <strong>{parentPath.join(" / ")}</strong>
              </>
            ) : (
              "At the top level of your library"
            )}
          </span>
        </div>
        <div className="dialog-actions">
          <button className="dialog-button" type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="dialog-button dialog-button-primary"
            type="submit"
            disabled={!name.trim()}
          >
            <FolderPlus size={15} />
            {isRename ? "Save name" : "Create folder"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
