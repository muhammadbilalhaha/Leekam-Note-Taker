import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  Copy,
  Folder,
  LayoutTemplate,
  Pencil,
  Plus,
  Sparkles,
  Tag,
  Trash2,
} from "lucide-react";
import { flattenFolderTree } from "../lib/folders";
import Modal from "./Modal";

function emptyForm() {
  return {
    name: "",
    description: "",
    titleTemplate: "",
    content: "",
    tags: "",
    folderId: "",
  };
}

function formFromTemplate(template) {
  return {
    name: template.name,
    description: template.description ?? "",
    titleTemplate: template.titleTemplate ?? "",
    content: template.content ?? "",
    tags: (template.defaultTags ?? []).join(", "),
    folderId: template.defaultFolderId ?? "",
  };
}

export default function TemplatePickerDialog({
  templates,
  folders,
  onUse,
  onSave,
  onDuplicate,
  onDelete,
  onClose,
}) {
  const [view, setView] = useState("list");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState(null);
  const folderOptions = useMemo(() => flattenFolderTree(folders), [folders]);

  const startCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setView("edit");
  };

  const startEdit = (template) => {
    setEditing(template);
    setForm(formFromTemplate(template));
    setView("edit");
  };

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const submit = (event) => {
    event.preventDefault();
    if (!form.name.trim()) return;
    onSave({
      ...(editing ? { id: editing.id, builtin: editing.builtin } : {}),
      name: form.name.trim(),
      description: form.description.trim(),
      titleTemplate: form.titleTemplate,
      content: form.content,
      defaultTags: form.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      defaultFolderId: form.folderId || null,
    });
    setView("list");
    setEditing(null);
    setForm(emptyForm());
  };

  return (
    <Modal
      title={view === "edit" ? (editing ? "Edit template" : "New template") : "Templates"}
      eyebrow={view === "edit" ? "Reusable starting points" : "Start with a little structure"}
      description={
        view === "edit"
          ? "Templates are stored locally. Creating a note copies this content, so later template edits never change existing notes."
          : "Choose a template for a new note, or shape your own collection of starting points."
      }
      onClose={onClose}
      width="wide"
    >
      {view === "edit" ? (
        <form className="template-form" onSubmit={submit}>
          <div className="template-form-row">
            <label className="field-label" htmlFor="template-name">
              Name
            </label>
            <input
              id="template-name"
              className="text-field"
              type="text"
              value={form.name}
              maxLength={80}
              onChange={(event) => update("name", event.target.value)}
              placeholder="Meeting notes"
              data-autofocus
            />
          </div>
          <div className="template-form-row">
            <label className="field-label" htmlFor="template-description">
              Short description
            </label>
            <input
              id="template-description"
              className="text-field"
              type="text"
              value={form.description}
              maxLength={240}
              onChange={(event) => update("description", event.target.value)}
              placeholder="Agenda, decisions, and follow-up tasks."
            />
          </div>
          <div className="template-form-grid">
            <div className="template-form-row">
              <label className="field-label" htmlFor="template-title">
                Default title
              </label>
              <input
                id="template-title"
                className="text-field"
                type="text"
                value={form.titleTemplate}
                maxLength={180}
                onChange={(event) => update("titleTemplate", event.target.value)}
                placeholder="Meeting notes — {{date}}"
              />
            </div>
            <div className="template-form-row">
              <label className="field-label" htmlFor="template-folder">
                Default folder
              </label>
              <select
                id="template-folder"
                className="select-field"
                value={form.folderId}
                onChange={(event) => update("folderId", event.target.value)}
              >
                <option value="">No folder</option>
                {folderOptions.map(({ folder, depth }) => (
                  <option key={folder.id} value={folder.id}>
                    {`${"— ".repeat(depth)}${folder.name}`}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="template-form-row">
            <label className="field-label" htmlFor="template-tags">
              Default tags
            </label>
            <input
              id="template-tags"
              className="text-field"
              type="text"
              value={form.tags}
              onChange={(event) => update("tags", event.target.value)}
              placeholder="meeting, work"
            />
            <span className="field-hint">Separate tags with commas.</span>
          </div>
          <div className="template-form-row">
            <label className="field-label" htmlFor="template-content">
              Markdown content
            </label>
            <textarea
              id="template-content"
              className="template-content-field"
              rows={9}
              value={form.content}
              onChange={(event) => update("content", event.target.value)}
              placeholder={"## Notes\n\n- [ ] First task"}
            />
            <span className="field-hint">
              Tokens: {"{{date}}"}, {"{{date_key}}"}, {"{{weekday}}"}, {"{{month}}"},
              {" {{year}}"}, {"{{time}}"}, and {"{{title}}"}.
            </span>
          </div>
          <div className="dialog-actions">
            <button className="dialog-button" type="button" onClick={() => setView("list")}>
              <ArrowLeft size={15} />
              Back to templates
            </button>
            <button
              className="dialog-button dialog-button-primary"
              type="submit"
              disabled={!form.name.trim()}
            >
              <Check size={15} />
              {editing ? "Save changes" : "Create template"}
            </button>
          </div>
        </form>
      ) : (
        <div className="template-dialog">
          <div className="template-dialog-toolbar">
            <p>
              {templates.length} {templates.length === 1 ? "template" : "templates"} stored locally
            </p>
            <button className="dialog-button dialog-button-primary" type="button" onClick={startCreate}>
              <Plus size={15} />
              New template
            </button>
          </div>

          {templates.length === 0 ? (
            <div className="template-empty">
              <span className="empty-list-icon">
                <LayoutTemplate size={22} />
              </span>
              <h3>No templates yet</h3>
              <p>Create a starting point for the kinds of notes you write often.</p>
              <button className="soft-button" type="button" onClick={startCreate}>
                Create a template
              </button>
            </div>
          ) : (
            <div className="template-grid">
              {templates.map((template) => (
                <article className="template-card" key={template.id}>
                  <div className="template-card-top">
                    <span className="template-card-icon">
                      {template.id === "template-daily" ? (
                        <Sparkles size={17} />
                      ) : (
                        <LayoutTemplate size={17} />
                      )}
                    </span>
                    <div className="template-card-heading">
                      <h3>{template.name}</h3>
                      {template.builtin && <span className="template-badge">Starter</span>}
                    </div>
                  </div>
                  <p className="template-card-description">
                    {template.description || "A reusable note template."}
                  </p>
                  <div className="template-card-meta">
                    {(template.defaultTags ?? []).slice(0, 3).map((tag) => (
                      <span className="mini-tag" key={tag}>
                        <Tag size={9} />
                        {tag}
                      </span>
                    ))}
                    {template.defaultFolderId && (
                      <span className="mini-tag mini-folder-tag">
                        <Folder size={9} />
                        {folders.find((folder) => folder.id === template.defaultFolderId)?.name ??
                          "Folder"}
                      </span>
                    )}
                  </div>
                  <div className="template-card-actions">
                    <button
                      className="dialog-button dialog-button-primary"
                      type="button"
                      onClick={() => onUse(template)}
                    >
                      Use template
                    </button>
                    <button
                      className="icon-button"
                      type="button"
                      onClick={() => startEdit(template)}
                      aria-label={`Edit ${template.name}`}
                      title="Edit template"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      className="icon-button"
                      type="button"
                      onClick={() => onDuplicate(template)}
                      aria-label={`Duplicate ${template.name}`}
                      title="Duplicate template"
                    >
                      <Copy size={15} />
                    </button>
                    {deleteId === template.id ? (
                      <span className="template-delete-confirm">
                        <button
                          className="dialog-button dialog-button-danger"
                          type="button"
                          onClick={() => {
                            onDelete(template);
                            setDeleteId(null);
                          }}
                        >
                          Delete
                        </button>
                        <button
                          className="dialog-button"
                          type="button"
                          onClick={() => setDeleteId(null)}
                        >
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <button
                        className="icon-button icon-button-danger"
                        type="button"
                        onClick={() => setDeleteId(template.id)}
                        aria-label={`Delete ${template.name}`}
                        title="Delete template"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
