# Paper Viewer

Read, highlight, and follow citations in research PDFs inside VS Code.

## Install locally

From the checkout, build and install the extension with Node.js 20 or later.

```sh
npm ci
npm run package
code --install-extension paper-viewer-0.0.1.vsix --force
```

You can also select the built file with **Extensions: Install from VSIX…** in
VS Code. If VS Code was open during installation, save your edits and run
**Developer: Reload Window**.

## Use it

Open a PDF with **Reopen Editor With… → Paper Viewer** if another editor
is selected.

- Click **Highlight** to toggle automatic highlighting when you select text.
  With the mode off, select text and press **H**, **Control–Command–H** on Mac or
  **Ctrl–Alt–H** on Windows and Linux. Add Shift to toggle the mode. Both
  shortcuts are configurable in VS Code.
- Open the swatch beside the highlighter to choose from Preview's yellow,
  green, blue, pink, and purple.
- **Paper Viewer: Text Highlight Thickness** controls the height of new
  text highlights. It defaults to 80% of the selected text height.
- Click an existing highlight and use its remove button or press Delete.
  Save with **Command–S** or **Ctrl–S**. Highlights are standard PDF
  annotations that can also be edited in Preview.
- Press **S** on selected text, a selected highlight, or immediately after
  making a highlight to attach a pop-up note. The **Notes** button also works
  with selected text or a highlight. Click the note icon to reopen it.
  With no selection, **Notes** opens the sidebar. In Preview, saved notes
  appear under **View → Highlights and Notes**.
- Use **Draw** and **Add or edit images** for other annotations.
- Click a linked citation to open its arXiv page, DOI, or paper URL in your
  browser. **Option-click** or **Alt-click** to jump to the bibliography.
  Unresolved citations also jump to the bibliography. The arXiv destination
  and citation hopping are configurable in VS Code settings.

Citation hopping supports named LaTeX bibliography links. For a recognizable
title without a link, it queries arXiv when you click and opens only a unique,
exact title match. Embedded figures and section links follow PDF navigation.

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
and `lib/pdfjs/build/pdf.worker.mjs`, plus the note dialog and Command Palette
changes in `lib/pdfjs/web/viewer.mjs`.

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
