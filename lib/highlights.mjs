import { AnnotationEditorParamsType, AnnotationEditorType } from './pdfjs/build/pdf.mjs';

const { NONE, HIGHLIGHT } = AnnotationEditorType;
const { HIGHLIGHT_COLOR } = AnnotationEditorParamsType;

// macOS Preview's AnnotationKit palette, converted to sRGB.
export const previewColors = {
  yellow: '#FACD5A',
  green: '#7CC868',
  blue: '#69B0F1',
  pink: '#FB5C89',
  purple: '#C885DA',
};

export function installHighlightControls(app, initialSettings, onColorChange) {
  const { eventBus, pdfViewer } = app;
  const getManager = () => pdfViewer._layerProperties.annotationEditorUIManager;
  const modeButton = document.getElementById('editorHighlightButton');
  const notesButton = document.getElementById('editorCommentButton');
  document.getElementById('editorFreeText').before(notesButton.parentElement);
  notesButton.removeAttribute('data-l10n-id');
  notesButton.setAttribute('aria-label', 'Notes');
  notesButton.title = 'Notes (S). Select text or a highlight to attach a note.';
  const controls = document.createElement('div');
  controls.className = 'paper-highlight-colors';
  controls.innerHTML = `
    <button type="button" class="paper-color-toggle" aria-label="Highlight color"
      aria-expanded="false" title="Highlight color"><span></span>⌄</button>
    <div class="paper-color-palette" role="group" aria-label="Highlight colors" hidden></div>
  `;
  modeButton.after(controls);
  const toggle = controls.querySelector('.paper-color-toggle');
  const palette = controls.querySelector('.paper-color-palette');
  const colorButtons = new Map();
  let color;
  let textHighlightScale;
  let oneShot = false;
  let auto = false;
  let selectedForEdit = false;
  let recentHighlightId;

  function setColor(name) {
    color = Object.hasOwn(previewColors, name) ? name : 'yellow';
    toggle.style.setProperty('--highlight-color', previewColors[color]);
    for (const [key, button] of colorButtons) {
      button.setAttribute('aria-pressed', String(key === color));
    }
    getManager()?.updateDefaultParams(HIGHLIGHT_COLOR, previewColors[color]);
  }

  function setSettings({ highlightColor, textHighlightThickness }) {
    setColor(highlightColor);
    textHighlightScale = Number.isFinite(textHighlightThickness)
      ? Math.min(100, Math.max(60, textHighlightThickness)) / 100
      : 0.8;
    const manager = getManager();
    if (manager) {
      manager.paperViewerTextHighlightScale = textHighlightScale;
    }
  }

  function showPalette(visible) {
    palette.hidden = !visible;
    toggle.setAttribute('aria-expanded', String(visible));
  }

  for (const [name, value] of Object.entries(previewColors)) {
    const button = document.createElement('button');
    const label = name[0].toUpperCase() + name.slice(1);
    button.type = 'button';
    button.title = label;
    button.setAttribute('aria-label', label);
    button.style.setProperty('--highlight-color', value);
    button.addEventListener('click', () => {
      setColor(name);
      onColorChange(name);
      showPalette(false);
      toggle.focus();
    });
    palette.append(button);
    colorButtons.set(name, button);
  }

  toggle.addEventListener('click', () => {
    showPalette(palette.hidden);
    if (!palette.hidden) {
      colorButtons.get(color).focus();
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !palette.hidden) {
      event.preventDefault();
      event.stopPropagation();
      showPalette(false);
      toggle.focus();
    }
  }, true);
  document.addEventListener('pointerdown', (event) => {
    if (!controls.contains(event.target)) {
      showPalette(false);
    }
  });

  function setAuto(enabled) {
    auto = enabled;
    const manager = getManager();
    if (manager) {
      manager.paperViewerAutoHighlight = enabled;
    }
    modeButton.setAttribute('aria-pressed', String(enabled));
  }

  function changeMode(mode, editId = null, editComment = false) {
    eventBus.dispatch('switchannotationeditormode', { source: controls, mode, editId, editComment });
  }

  function toggleMode() {
    if (!app.pdfDocument || modeButton.disabled || oneShot) {
      return;
    }
    setAuto(!auto);
    changeMode(auto ? HIGHLIGHT : NONE);
  }

  modeButton.removeAttribute('aria-controls');
  modeButton.removeAttribute('aria-haspopup');
  modeButton.addEventListener('click', (event) => {
    if (event.isTrusted) {
      event.stopImmediatePropagation();
      toggleMode();
    }
  }, true);

  eventBus.on('annotationeditoruimanager', ({ uiManager }) => {
    oneShot = false;
    recentHighlightId = undefined;
    setAuto(false);
    setColor(color);
    uiManager.paperViewerTextHighlightScale = textHighlightScale;
  });
  eventBus.on('annotationeditormodechanged', ({ mode }) => {
    modeButton.removeAttribute('aria-expanded');
    if (mode !== HIGHLIGHT) {
      selectedForEdit = false;
      setAuto(false);
    } else if (oneShot) {
      oneShot = false;
      changeMode(NONE);
    }
    modeButton.classList.toggle('toggled', auto);
  });
  eventBus.on('editingstateschanged', ({ details }) => {
    if (details.hasSelectedEditor && !auto && pdfViewer.annotationEditorMode === HIGHLIGHT) {
      selectedForEdit = true;
    } else if (selectedForEdit && !details.hasSelectedEditor) {
      selectedForEdit = false;
      // Let PDF.js finish its own selection or deletion before changing tools.
      queueMicrotask(() => {
        if (!auto && !getManager()?.hasSelection && pdfViewer.annotationEditorMode === HIGHLIGHT) {
          changeMode(NONE);
        }
      });
    }
  });
  eventBus.on('annotationeditorlayerrendered', () =>
    getManager()?.updateDefaultParams(HIGHLIGHT_COLOR, previewColors[color])
  );
  eventBus.on('paperviewerhighlightcreated', ({ editor }) => {
    recentHighlightId = editor.id;
  });
  eventBus.on('pagechanging', () => {
    recentHighlightId = undefined;
  });
  document.addEventListener('pointerdown', (event) => {
    if (!notesButton.contains(event.target)) {
      recentHighlightId = undefined;
    }
  }, true);

  function canHighlightSelection(manager) {
    const selection = document.getSelection();
    const anchor = selection?.anchorNode;
    const anchorElement = anchor?.nodeType === Node.ELEMENT_NODE ? anchor : anchor?.parentElement;
    const layer = anchorElement?.closest('.textLayer');
    return manager?.currentLayer && selection?.toString().trim() && manager.getSelectionBoxes(layer);
  }

  function highlightSelection() {
    const manager = getManager();
    const mode = pdfViewer.annotationEditorMode;
    if (oneShot || (mode !== NONE && mode !== HIGHLIGHT) || !canHighlightSelection(manager)) {
      return false;
    }
    oneShot = mode === NONE;
    manager.highlightSelection('keyboard');
    return true;
  }

  function noteTarget(manager) {
    const selected = manager?.firstSelectedEditor;
    return selected?.editorType === 'highlight' ? selected : manager?.getEditor(recentHighlightId);
  }

  function addNote(method) {
    const manager = getManager();
    const mode = pdfViewer.annotationEditorMode;
    if (oneShot || (mode !== NONE && mode !== HIGHLIGHT)) {
      return false;
    }
    if (canHighlightSelection(manager)) {
      manager.commentSelection(method);
      return true;
    }
    const editor = noteTarget(manager);
    if (!editor?.parent || editor.deleted) {
      return false;
    }
    if (mode === NONE) {
      changeMode(HIGHLIGHT, editor.uid, true);
    } else {
      editor.editComment();
    }
    return true;
  }

  notesButton.addEventListener('mousedown', (event) => {
    const manager = getManager();
    if (canHighlightSelection(manager) || noteTarget(manager)) {
      event.preventDefault();
    }
  });
  notesButton.addEventListener('click', (event) => {
    if (addNote('main_toolbar')) {
      event.stopImmediatePropagation();
    }
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.defaultPrevented || event.repeat || event.isComposing || event.altKey || event.ctrlKey ||
        event.metaKey || event.shiftKey || app.overlayManager.active ||
        event.target.closest('input, textarea, select, [contenteditable]')) {
      return;
    }
    const key = event.key.toLowerCase();
    if ((key === 'h' && highlightSelection()) || (key === 's' && addNote('keyboard'))) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);

  // Existing highlights use PDF.js' own editable annotation and undo machinery.
  // Inspect the hit after a click so drags still select text.
  app.appConfig.viewerContainer.addEventListener('click', (event) => {
    const manager = getManager();
    const mode = pdfViewer.annotationEditorMode;
    if (!manager || oneShot || (mode !== NONE && mode !== HIGHLIGHT) ||
        event.button || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey ||
        !document.getSelection()?.isCollapsed || event.target.closest('a, button, .editToolbar')) {
      return;
    }
    const layer = event.target.closest('.page')?.querySelector('.annotationEditorLayer');
    layer?.classList.add('paper-highlight-hit-test');
    const hit = document.elementsFromPoint(event.clientX, event.clientY).find((element) =>
      element.matches('.highlightEditor .internal, .highlightAnnotation, .highlightAnnotation *')
    );
    layer?.classList.remove('paper-highlight-hit-test');

    const editor = manager.getEditor(hit?.closest('.highlightEditor')?.id);
    const editId = hit?.closest('.highlightAnnotation')?.dataset.annotationId;
    if (mode === NONE && (editor || editId)) {
      changeMode(HIGHLIGHT, editor?.uid ?? editId);
    } else if (editor) {
      manager.setSelected(editor);
      editor.focus();
    } else if (mode === HIGHLIGHT && !auto) {
      changeMode(NONE);
    }
  });

  setSettings(initialSettings);
  setAuto(false);
  return { highlightSelection, toggleMode, setSettings };
}
