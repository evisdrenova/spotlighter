import * as vscode from "vscode";

// More visible opacity difference to make the effect more noticeable
const DIM_DECORATION = vscode.window.createTextEditorDecorationType({
  opacity: "0.3",
  backgroundColor: "rgba(128,128,128,0.05)",
});

const NORMAL_DECORATION = vscode.window.createTextEditorDecorationType({
  opacity: "1.0",
});

// Supported languages
const SUPPORTED_LANGUAGES = ["rust", "typescript", "typescriptreact"];

/**
 * Activates the extension.
 */
export function activate(context: vscode.ExtensionContext) {
  console.log("Function Spotlighter extension is active.");

  // Register the command that can be called from Command Palette
  const enableCmd = vscode.commands.registerCommand(
    "spotlighter.enable",
    () => {
      vscode.window.showInformationMessage("Function Spotlighter enabled");
    }
  );

  context.subscriptions.push(enableCmd);

  // Register debug command
  registerDebugCommand(context);

  // Whenever the cursor moves, update decorations.
  const disposable = vscode.window.onDidChangeTextEditorSelection(
    async (event) => {
      const editor = event.textEditor;
      if (!editor) {
        return;
      }

      const doc = editor.document;

      // Only run on supported files
      if (!SUPPORTED_LANGUAGES.includes(doc.languageId)) {
        // Clear decorations if we're no longer in a supported file
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
          selection.active,
          doc.languageId
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
    const editor = vscode.window.activeTextEditor;
    if (SUPPORTED_LANGUAGES.includes(editor.document.languageId)) {
      updateDecorations(editor);
    }
  }

  // Register a command to manually update decorations
  const updateCmd = vscode.commands.registerCommand(
    "spotlighter.updateDecorations",
    () => {
      const editor = vscode.window.activeTextEditor;
      if (editor && SUPPORTED_LANGUAGES.includes(editor.document.languageId)) {
        updateDecorations(editor);
      }
    }
  );

  context.subscriptions.push(updateCmd);
}

/**
 * Update decorations for the current cursor position
 */
async function updateDecorations(editor: vscode.TextEditor) {
  if (!editor) return;

  const doc = editor.document;
  const position = editor.selection.active;

  try {
    // Get all symbols in this file
    const symbols = (await vscode.commands.executeCommand(
      "vscode.executeDocumentSymbolProvider",
      doc.uri
    )) as vscode.DocumentSymbol[] | undefined;

    if (!symbols || symbols.length === 0) {
      clearAllDecorations(editor);
      return;
    }

    // Find the function symbol containing the cursor
    const functionSymbol = findEnclosingFunctionSymbol(
      symbols,
      position,
      doc.languageId
    );

    if (!functionSymbol) {
      clearAllDecorations(editor);
      return;
    }

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
    console.error("Error updating decorations:", err);
    clearAllDecorations(editor);
  }
}

/**
 * Recursively find the symbol (of kind Function/Method) that encloses a position.
 * If multiple nest, return the most deeply nested.
 */
function findEnclosingFunctionSymbol(
  symbols: vscode.DocumentSymbol[],
  position: vscode.Position,
  languageId: string
): vscode.DocumentSymbol | undefined {
  let found: vscode.DocumentSymbol | undefined = undefined;

  for (const sym of symbols) {
    if (sym.range.contains(position)) {
      // If it's a function or method, hold onto it
      if (isFunction(sym, languageId)) {
        found = sym;
      }

      // Check children to see if there's a nested symbol
      const childMatch = findEnclosingFunctionSymbol(
        sym.children,
        position,
        languageId
      );
      if (childMatch) {
        // If child is also a function, prefer the deeper nested one
        found = childMatch;
      }
    }
  }

  return found;
}

/**
 * Determine if a symbol is a function based on language-specific rules
 */
function isFunction(sym: vscode.DocumentSymbol, languageId: string): boolean {
  // Common function kinds across languages
  if (
    sym.kind === vscode.SymbolKind.Function ||
    sym.kind === vscode.SymbolKind.Method ||
    sym.kind === vscode.SymbolKind.Constructor
  ) {
    return true;
  }

  // Language-specific rules
  switch (languageId) {
    case "rust":
      // For Rust, also consider impl blocks and modules
      return (
        sym.kind === vscode.SymbolKind.Module ||
        sym.kind === vscode.SymbolKind.Namespace
      );

    case "typescript":
    case "typescriptreact":
      // For TypeScript/TSX, also consider arrow functions and class methods
      // Most arrow functions should be caught by SymbolKind.Function already
      // but we can add additional checks here if needed
      return (
        sym.kind === vscode.SymbolKind.Class || // For class methods
        sym.kind === vscode.SymbolKind.Field || // For class fields that might be arrow functions
        sym.kind === vscode.SymbolKind.Variable // For variables that might be arrow functions
      );

    default:
      return false;
  }
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
