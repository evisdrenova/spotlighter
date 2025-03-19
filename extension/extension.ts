import * as vscode from "vscode";

// More visible opacity difference to make the effect more noticeable
const DIM_DECORATION = vscode.window.createTextEditorDecorationType({
  opacity: "0.3",
  backgroundColor: "rgba(128,128,128,0.05)",
});

const NORMAL_DECORATION = vscode.window.createTextEditorDecorationType({
  opacity: "1.0",
});

/**
 * Activates the extension.
 */
export function activate(context: vscode.ExtensionContext) {
  console.log("Focus Rust Fn extension is active.");

  // Register the command that can be called from Command Palette
  const enableCmd = vscode.commands.registerCommand(
    "spotlighter.enable",
    () => {
      vscode.window.showInformationMessage("Rust Function Spotlighter enabled");
    }
  );

  context.subscriptions.push(enableCmd);

  // Whenever the cursor moves, update decorations.
  const disposable = vscode.window.onDidChangeTextEditorSelection(
    async (event) => {
      const editor = event.textEditor;
      if (!editor) {
        return;
      }

      const doc = editor.document;

      // Only run on Rust files
      if (doc.languageId !== "rust") {
        // Clear decorations if we're no longer in a Rust file
        clearAllDecorations(editor);
        return;
      }

      // We only handle the first selection for simplicity
      const selection = event.selections[0];
      if (!selection) {
        return;
      }

      try {
        // 1. Get all symbols in this file via the built-in symbol provider
        const symbols = (await vscode.commands.executeCommand(
          "vscode.executeDocumentSymbolProvider",
          doc.uri
        )) as vscode.DocumentSymbol[] | undefined;

        if (!symbols || symbols.length === 0) {
          console.log("No symbols found in this document");
          clearAllDecorations(editor);
          return;
        }

        // 2. Find the function symbol containing the cursor
        const functionSymbol = findEnclosingFunctionSymbol(
          symbols,
          selection.active
        );

        if (!functionSymbol) {
          // If we didn't find a function, clear decorations
          console.log("No function found at current position");
          clearAllDecorations(editor);
          return;
        }

        console.log(
          `Found function: ${functionSymbol.name} at range: ${functionSymbol.range.start.line}-${functionSymbol.range.end.line}`
        );

        // 3. Apply decorations: First clear existing ones
        clearAllDecorations(editor);

        // Create ranges for the rest of the document that should be dimmed
        const ranges: vscode.Range[] = [];

        // Add range from start of document to start of function
        if (functionSymbol.range.start.line > 0) {
          ranges.push(
            new vscode.Range(
              new vscode.Position(0, 0),
              new vscode.Position(functionSymbol.range.start.line, 0)
            )
          );
        }

        // Add range from end of function to end of document
        const lastLine = doc.lineCount - 1;
        if (functionSymbol.range.end.line < lastLine) {
          ranges.push(
            new vscode.Range(
              new vscode.Position(
                functionSymbol.range.end.line,
                doc.lineAt(functionSymbol.range.end.line).text.length
              ),
              new vscode.Position(lastLine, doc.lineAt(lastLine).text.length)
            )
          );
        }

        // Apply decorations
        editor.setDecorations(DIM_DECORATION, ranges);
        editor.setDecorations(NORMAL_DECORATION, [functionSymbol.range]);
      } catch (err) {
        console.error("Error retrieving or parsing symbols:", err);
        clearAllDecorations(editor);
      }
    }
  );

  context.subscriptions.push(disposable);

  // Initial decoration update for the active editor
  if (vscode.window.activeTextEditor) {
    vscode.commands.executeCommand("spotlighter.updateDecorations");
  }
}

/**
 * Recursively find the symbol (of kind Function/Method) that encloses a position.
 * If multiple nest, return the most deeply nested.
 */
function findEnclosingFunctionSymbol(
  symbols: vscode.DocumentSymbol[],
  position: vscode.Position
): vscode.DocumentSymbol | undefined {
  let found: vscode.DocumentSymbol | undefined = undefined;

  for (const sym of symbols) {
    if (sym.range.contains(position)) {
      // If it's a function or method, hold onto it
      if (
        sym.kind === vscode.SymbolKind.Function ||
        sym.kind === vscode.SymbolKind.Method ||
        // Rust-specific symbols that may represent functions
        sym.kind === vscode.SymbolKind.Constructor ||
        sym.kind === vscode.SymbolKind.Module || // For impl blocks
        sym.kind === vscode.SymbolKind.Namespace // For impl blocks
      ) {
        found = sym;
      }

      // Check children to see if there's a nested symbol
      const childMatch = findEnclosingFunctionSymbol(sym.children, position);
      if (childMatch) {
        // If child is also a function, prefer the deeper nested one
        found = childMatch;
      }
    }
  }

  return found;
}

/**
 * Clears all decorations in the given editor.
 */
function clearAllDecorations(editor: vscode.TextEditor) {
  editor.setDecorations(DIM_DECORATION, []);
  editor.setDecorations(NORMAL_DECORATION, []);
}

// For debugging: register a command to log all symbols in the current document
function registerDebugCommand(context: vscode.ExtensionContext) {
  const debugCmd = vscode.commands.registerCommand(
    "spotlighter.debugSymbols",
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showInformationMessage("No active editor");
        return;
      }

      const symbols = (await vscode.commands.executeCommand(
        "vscode.executeDocumentSymbolProvider",
        editor.document.uri
      )) as vscode.DocumentSymbol[];

      console.log("All symbols:", symbols);
      vscode.window.showInformationMessage(
        `Found ${symbols?.length || 0} symbols`
      );
    }
  );

  context.subscriptions.push(debugCmd);
}

export function deactivate() {
  // Clean up all decorations when deactivating
  if (vscode.window.activeTextEditor) {
    clearAllDecorations(vscode.window.activeTextEditor);
  }
}
