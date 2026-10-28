# Leekam

A calm, local-first knowledge base built with React and Vite. Notes live entirely in your browser — there is no database, account, backend, or external AI service.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. To create a production build:

```bash
npm run build
npm run preview
```

Run the automated tests with:

```bash
npm test
```

## Features

- Create, edit, favorite, pin, and delete notes with automatic local saving
- **Markdown editor** with Write, Split, and Preview modes, a formatting toolbar, and keyboard shortcuts
- Tick task checkboxes directly in the rendered preview
- Internal `[[wiki links]]` with autocomplete, click-to-open navigation, backlinks, and broken-link reporting
- Rule-based related-note suggestions with short explanations — no AI or external requests
- Interactive knowledge graph with zoom, pan, node dragging, local/global views, folder filters, and a list fallback
- Daily notes with a Today command, previous/next navigation, and a configurable title/template
- Reusable note templates with custom title tokens, default folders, default tags, and duplicate/edit/delete controls
- Nested folders with create, rename, delete, note counts, and move-to-folder controls
- Tags, favorites, pinned notes, and Trash
- Extended search filters and saved searches
- Dashboard with recent notes, today's note, favorites, saved searches, broken links, and isolated notes
- Local version history with diffs, confirmed restores, and retention limits
- JSON backups for the complete library, plus portable Markdown vault export/import
- Storage-usage monitoring, save-status feedback, and backup reminders
- Note colors, light/dark themes, and undo after deleting
- Responsive desktop, tablet, and single-pane mobile layouts

## Internal links

Type `[[` in the editor to search active notes by title. Use the arrow keys and `Enter`/`Tab` to insert a suggestion, or click one. The toolbar link button can also insert a wiki link.

- `[[Title]]` links to a note by title when the title is unique
- `[[Title|noteId]]` disambiguates duplicate titles and is used automatically when a title contains `|`, `[`, `]`, or a line break
- Renaming a note rewrites unambiguous title links in other notes
- Links to Trashed notes resolve as unavailable until the note is restored
- Links inside fenced code blocks and inline code are ignored
- The **Links & related notes** panel shows backlinks, outgoing links, unresolved links, and related notes
- Related notes can be opened or inserted as links without leaving the editor
- In Preview, clicking an internal link opens that note; external links open in a new tab

Backlinks and graph edges are derived from note content, so the index never drifts from the Markdown source.

## Knowledge graph

Open **Graph** from the sidebar or press `Ctrl/⌘ Shift G`. The graph supports:

- Drag to pan and use the zoom controls (or the mouse wheel) to inspect clusters
- Drag individual nodes to rearrange the view
- **Local graph** to focus on the current note and its direct neighbors
- Folder filtering, including descendant folders
- Hover highlighting for a node's neighbors
- A **Browse list** fallback with connection counts for keyboard and small-screen use

Graph layout is generated locally with SVG. No graph or layout dependency is required. Very large graphs switch to a simplified radial layout to stay responsive.

## Daily notes

Use **Today** in the sidebar or press `Ctrl/⌘ Shift D`. Daily notes use the local calendar date and are unique per day, so opening Today repeatedly returns the same note.

- Previous/Next navigate by day and create the note when it does not exist yet
- The daily title and note template are configurable in **Backup & settings**
- Date tokens include `{{date}}`, `{{date_key}}`, `{{weekday}}`, `{{month}}`, `{{year}}`, `{{time}}`, and `{{title}}`
- Daily notes work with folders, tags, search, Markdown, links, favorites, and version history
- If a daily note is in Trash, opening that date restores it automatically

## Templates

Choose **Start from a template** to create a note from a starter or custom template. Templates can be created, edited, duplicated, and deleted. A template may define:

- A name and description
- A default title, including date/title tokens
- A default folder and default tags
- Markdown content

Creating a note copies the template content, so later template edits do not change existing notes. Starter templates are seeded only on first use; if you delete them all, they are not silently recreated.

## Search

Use the search field in the library or press `Ctrl/⌘ K`. Searches cover titles, Markdown content, tags, folders, and built-in views. Results are grouped with highlighted matches and snippets. Press `Enter` to open the first result and `Escape` to clear the query.

Filters can be combined in the same query:

```text
tag:work folder:projects is:pinned updated:7d has:links
```

- `tag:name` — notes with that tag
- `folder:name` — notes in a folder and its descendants; use `folder:none` for unfiled notes
- `is:pinned` — pinned notes
- `updated:7d` — updated within the last 7 days (also supports `24h`, `2w`, and similar)
- `has:links` — notes with at least one resolved outgoing link
- `has:backlinks` — notes linked from at least one active note
- Quote values containing spaces, for example `tag:"deep work"`
- Combine filters with free text; invalid filters fail closed rather than showing unrelated notes

Use **Save search** to keep a query in the sidebar and dashboard. Renaming a saved search changes only its name; deleting it never affects notes. In Trash, search stays scoped to deleted notes.

## Dashboard

**Home** collects:

- Recently opened and recently edited notes
- Favorites and today's daily note
- Saved searches
- Notes with unresolved links
- Isolated notes with no resolved connections

Favorites are separate from pins: favorites appear on the dashboard, while pinned notes stay at the top of the library.

## Version history

Leekam snapshots a note before content or title edits and at most once every five minutes per note. Use the history button above the editor to:

- Review timestamped snapshots and word counts
- Compare a snapshot with the current note
- Save the current state manually
- Restore a snapshot after confirmation; the current note is snapshotted first

Snapshots are capped per note and globally. Empty new notes are not snapshotted. Version history stays local and is included in JSON backups.

## Backup, restore, and portability

Open **Backup** at the bottom of the sidebar.

### JSON backup

A JSON backup includes every note, folder, Trash item, setting, template, saved search, recent-note entry, and version snapshot. Imported files are validated and summarized before anything is replaced, and the final restore asks for confirmation. Legacy version-1 backups and raw notes arrays are accepted.

### Markdown vault

Export a `.zip` containing one Markdown file per active note. Files use YAML-style front matter with a stable `leekam-id`, title, tags, folder, timestamps, favorite/pin state, and color. Wiki links remain readable Markdown.

Import individual Markdown files or a folder. The preview summarizes notes, new folders, duplicate IDs, and link resolution before you choose:

- **Merge** — add imported notes and folders, repairing duplicate IDs
- **Replace notes and folders** — replace notes and folders while keeping templates, saved searches, and settings

The Markdown vault excludes Trash and version history. Use a JSON backup when you need a complete copy.

### Per-note export

Individual notes can be exported from the editor as Markdown (`.md`) or plain text (`.txt`).

## Storage and safety

Leekam saves to this browser's local storage. Browser storage is not a permanent archive: clearing site data, using private browsing, or browser cleanup can remove the library.

- The save status shows **Saving**, **Saved locally**, or **Save failed**
- Storage usage and the browser quota are shown in Backup & settings
- Warnings appear when usage crosses the configured threshold
- A failed save keeps the latest edit on screen and warns you; export a backup before clearing space
- Backup reminders appear on the dashboard based on the configured interval
- Emptying Trash, lowering version retention, or exporting/deleting old data can free space

There is no server-side draft recovery. If a save fails, the unsaved text remains in the open tab until you can free storage or copy it elsewhere.

Storage keys:

- `leekam.notes.v1` — notes and Trash
- `leekam.folders.v1` — folder tree
- `leekam.settings.v1` — daily-note settings, Trash retention, storage warning, backup reminder, and last backup time
- `leekam.knowledge.v1` — templates, saved searches, and recently opened notes
- `leekam.versions.v1` — local version snapshots
- `leekam.theme` — light/dark preference

## Keyboard shortcuts

- `Ctrl/⌘ K` — focus search
- `Ctrl/⌘ Shift D` — open today's daily note
- `Ctrl/⌘ Shift G` — open the knowledge graph
- `Ctrl/⌘ B`, `Ctrl/⌘ I`, `Ctrl/⌘ E` — bold, italic, and inline code
- `Ctrl/⌘ Shift K` — insert an external link
- `Ctrl/⌘ Shift L` — insert an internal note link
- `Ctrl/⌘ Z` / `Ctrl/⌘ Shift Z` — undo/redo in the editor
- `Enter` / `Tab` — accept a wiki-link autocomplete suggestion
- `Escape` — close a dialog or autocomplete menu

Dialogs trap keyboard focus, restore focus when closed, and close on `Escape`.

## Markdown behavior

Markdown is the storage format, so source remains portable. The toolbar adds headings, code blocks, quotes, bullet/numbered lists, and task lists. List and quote markers continue automatically on `Enter`. Split view shows a live preview; Preview shows the rendered note alone.

Internal `leekam-note://` links are handled by the app. Preview blocks dangerous `javascript:`, `vbscript:`, and `data:` URLs while preserving relative and external links.

## Limitations

- Everything is local to one browser profile; there is no sync between devices or browsers
- There are no accounts, sharing, collaboration, or server-side recovery
- Related notes are rule-based keyword/tag/link suggestions, not semantic AI
- The graph is intentionally lightweight; very large libraries use a simplified layout
- Markdown vault import preserves note metadata but excludes Trash and version history
- Version snapshots consume the same browser quota as notes

## Project structure

```text
src/
  App.jsx                    Application state, navigation, and feature orchestration
  components/
    Sidebar.jsx              Navigation, folders, tags, templates, and saved searches
    NoteList.jsx             Library, search results, Trash, and empty states
    NoteEditor.jsx           Markdown editor, wiki links, daily navigation, and connections
    Dashboard.jsx            Home dashboard sections
    GraphView.jsx            Interactive SVG graph and list fallback
    ConnectionsPanel.jsx     Backlinks, outgoing links, unresolved links, and related notes
    DataDialog.jsx           Backup, vault tools, storage health, and settings
    TemplatePickerDialog.jsx Template create/edit/duplicate/delete and note creation
    VersionHistoryDialog.jsx Version list, diff, and restore
    FolderDialog.jsx         Create and rename folder dialog
    ConfirmDialog.jsx        Destructive action confirmation
    TextPromptDialog.jsx     Rename and naming prompts
    Modal.jsx                Shared accessible modal shell
    Toast.jsx                Undo and status messages
  lib/
    notes.js                 Storage, filters, advanced search, and formatting
    folders.js               Folder persistence, tree, counts, and cleanup
    links.js                 Wiki-link parsing, resolution, backlinks, and rename rewriting
    related.js               Local related-note scoring and explanations
    graph.js                 Graph construction, filtering, and local views
    daily.js                 Daily-note dates, titles, and templates
    templates.js             Template defaults and token expansion
    knowledge.js             Templates, saved searches, and recent notes
    versions.js              Snapshots, diffs, retention, and pruning
    vault.js                 Markdown vault export/import and front matter
    zip.js                   Dependency-free store-only ZIP support
    backup.js                Backup validation, migration, and downloads
    storage.js               Storage health, warnings, and JSON helpers
    markdown.js              Markdown-to-text helpers, stats, exports, and task toggling
  styles.css                 Responsive layout, Markdown typography, and theming
tests/
  advanced-search.test.js    Filter parsing, combinations, and Trash behavior
  daily-templates.test.js    Daily notes, templates, and token expansion
  links.test.js              Wiki links, ambiguity, backlinks, and rename rewriting
  related-graph.test.js      Related-note scoring and graph views
  search.test.js             Search matching, grouping, folders, and Trash
  vault.test.js              Markdown vault round-trips and front matter
  versions-storage.test.js   Snapshots, diffs, backup migration, and storage failures
  workspace.test.js          Folder, Markdown, Trash, and backup tests
```
