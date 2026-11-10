import * as vscode from 'vscode';
import { PdfEditorProvider } from './pdfProvider';

export function activate(context: vscode.ExtensionContext): void {
  const log = vscode.window.createOutputChannel('Paper Viewer', { log: true });
  const provider = new PdfEditorProvider(context.extensionUri, log);
  context.subscriptions.push(
    log,
    vscode.window.registerCustomEditorProvider(
      PdfEditorProvider.viewType,
      provider,
      {
        webviewOptions: { retainContextWhenHidden: true },
        supportsMultipleEditorsPerDocument: false,
      }
    ),
    vscode.commands.registerCommand('paperViewer.highlightSelection', () =>
      provider.sendAction('highlightSelection')
    ),
    vscode.commands.registerCommand('paperViewer.toggleHighlightMode', () =>
      provider.sendAction('toggleHighlightMode')
    ),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('paper-viewer.highlightColor') ||
          event.affectsConfiguration('paper-viewer.textHighlightThickness')) {
        provider.updateHighlightSettings();
      }
    })
  );
}

export function deactivate(): void {}
