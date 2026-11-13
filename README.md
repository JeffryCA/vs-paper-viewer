# Paper Viewer – Academic PDF Reader

Read and annotate research papers directly in VS Code.

**[Install from the VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=jeffryca.paper-viewer)** · Requires VS Code 1.123 or later.

## Quick start

1. Open a PDF. If it opens in another viewer, choose **Reopen Editor With… → Paper Viewer**.
2. Select text and press **H** to highlight it or **S** to add a sticky note.
3. Save annotations to the PDF with **⌘S** on Mac or **Ctrl+S** on Windows and Linux.

## Features

### Highlights and sticky notes

- Click **Highlight** to toggle automatic highlighting when you select text.
  With the mode off, select text and press **H**, **Control–Command–H** on Mac or
  **Ctrl–Alt–H** on Windows and Linux. Add Shift to toggle the mode. Both
  shortcuts are configurable in VS Code.
- Open the swatch beside the highlighter to choose from Preview's yellow,
  green, blue, pink, and purple.
- **Paper Viewer: Text Highlight Thickness** controls the height of new
  text highlights. It defaults to 80% of the selected text height.
- Click an existing highlight and use its remove button or press Delete.
- Press **S** on selected text, a selected highlight, or immediately after
  making a highlight to attach a pop-up note. The **Notes** button also works
  with selected text or a highlight. Click the note icon to reopen it.
  With no selection, **Notes** opens the sidebar.
- Use **Draw** and **Add or edit images** for other annotations.

### Citation navigation

Click a linked citation to open its arXiv page, DOI, or paper URL in your
browser. **Option-click** or **Alt-click** to jump to the bibliography.
Unresolved citations also jump to the bibliography. Set your preferred arXiv
destination in VS Code settings.

Citation hopping supports named LaTeX bibliography links. For a recognizable
title without a link, it queries arXiv when you click and opens only a unique,
exact title match. Embedded figures and section links follow PDF navigation.

### Codex and Claude Code

In a trusted local VS Code window, select PDF text or click a saved highlight.
Click the Codex or Claude Code icon above it to add an excerpt to that
extension's chat draft. Paper Viewer automatically includes the paper filename,
page number, highlighted text, and any attached note. Each icon appears when
its extension is available. You can add a question and send the draft when ready.

### macOS Preview compatibility

Paper Viewer saves highlights and notes as annotations inside the PDF. Save
the file in VS Code, then open that same PDF in Preview. Choose
**View → Highlights and Notes** to see saved highlights and their notes.

You can also open a PDF annotated in Preview, remove its highlights, and
edit its notes in Paper Viewer. Save the PDF before switching between apps
so the other viewer can load the latest changes.

<details>
<summary>Install from source</summary>

With Node.js 20 or later, run these commands from the repository checkout.

```sh
npm ci
npm run package
```

In VS Code, run **Extensions: Install from VSIX…** and select the generated package.
If VS Code was already open, save your edits and run **Developer: Reload Window**.

</details>

## Develop

```sh
npm ci
npm run compile
npm test
npm run package
```

Press **F5** in VS Code to launch an Extension Development Host. The custom
editor is in `src/pdfProvider.ts`. The webview glue is in `lib/main.mjs`.
If updating PDF.js, reapply the annotation hooks in `lib/pdfjs/build/pdf.mjs`
and `lib/pdfjs/build/pdf.worker.mjs`, plus the note dialog and keyboard
shortcut changes in `lib/pdfjs/web/viewer.mjs`.

## Credits and licenses

- Tomoki Maruyama and the vscode-pdf contributors built the original VS Code
  PDF extension. [vscode-pdf](https://github.com/tomoki1207/vscode-pdfviewer)
- Max Hölper's PDF Markup fork added the custom editor, annotation tools, and
  in-place PDF saving that Paper Viewer builds on. [PDF Markup](https://github.com/maxhoelper/vscode-pdf-editor)
- Mozilla and the PDF.js contributors built the renderer and viewer used by
  both projects. [PDF.js](https://github.com/mozilla/pdf.js)
- Jeffry Cacho's arXiv Hop extension supplies the citation resolver adapted for
  Paper Viewer. [arXiv Hop](https://github.com/JeffryCA/arxiv-hop)

Paper Viewer is MIT-licensed. The bundled PDF.js is licensed under Apache 2.0.
[Project license](./LICENSE) · [PDF.js license](./lib/pdfjs/LICENSE)
