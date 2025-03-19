import * as vscode from "vscode";

/**
 * Get decoration types based on user settings
 */
function getDecorationTypes(): {
  dimDecoration: vscode.TextEditorDecorationType;
  normalDecoration: vscode.TextEditorDecorationType;
} {
  const config = vscode.workspace.getConfiguration("spotlighter");
  const dimOpacity = config.get<number>("dimOpacity") || 0.3;
  const dimBackground = config.get<boolean>("dimBackground") || true;
  const dimColor =
    config.get<string>("dimBackgroundColor") || "rgba(128,128,128,0.05)";
  const normalOpacity = config.get<number>("normalOpacity") || 1.0;

  const dimDecoration = vscode.window.createTextEditorDecorationType({
    opacity: dimOpacity.toString(),
    backgroundColor: dimBackground ? dimColor : undefined,
  });

  const normalDecoration = vscode.window.createTextEditorDecorationType({
    opacity: normalOpacity.toString(),
  });

  return { dimDecoration, normalDecoration };
}

// Supported languages
const SUPPORTED_LANGUAGES = [
  "rust",
  "typescript",
  "typescriptreact",
  "python",
  "javascript",
  "javascriptreact",
  "go",
];

let dimDecoration: vscode.TextEditorDecorationType;
let normalDecoration: vscode.TextEditorDecorationType;

/**
 * Activates the extension.
 */
export function activate(context: vscode.ExtensionContext) {
  console.log("Function Spotlighter extension is active.");

  // Initialize decorations from user settings
  const decorations = getDecorationTypes();
  dimDecoration = decorations.dimDecoration;
  normalDecoration = decorations.normalDecoration;

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

  // Register a command to toggle the extension on/off
  const toggleCmd = vscode.commands.registerCommand(
    "spotlighter.toggle",
    () => {
      const config = vscode.workspace.getConfiguration("spotlighter");
      const currentEnabledState = config.get<boolean>("enabled") || true;

      // Toggle the enabled state
      config.update("enabled", !currentEnabledState, true).then(() => {
        const newState = !currentEnabledState ? "enabled" : "disabled";
        vscode.window.showInformationMessage(
          `Function Spotlighter ${newState}`
        );

        // Update decorations based on new state
        const editor = vscode.window.activeTextEditor;
        if (editor) {
          if (!currentEnabledState) {
            // Just turned on, update decorations
            updateDecorations(editor);
          } else {
            // Just turned off, clear decorations
            clearAllDecorations(editor);
          }
        }
      });
    }
  );

  context.subscriptions.push(toggleCmd);

  // Whenever the cursor moves, update decorations.
  const disposable = vscode.window.onDidChangeTextEditorSelection(
    async (event) => {
      const editor = event.textEditor;
      if (!editor) {
        return;
      }

      const doc = editor.document;

      // Only run on supported files and if enabled
      const config = vscode.workspace.getConfiguration("spotlighter");
      const isEnabled = config.get<boolean>("enabled") ?? true;

      if (!isEnabled || !SUPPORTED_LANGUAGES.includes(doc.languageId)) {
        // Clear decorations if we're no longer in a supported file or disabled
        clearAllDecorations(editor);
        return;
      }

      // We only handle the first selection for simplicity
      const selection = event.selections[0];
      if (!selection) {
        return;
      }

      await updateDecorationsForPosition(editor, selection.active);
    }
  );

  context.subscriptions.push(disposable);

  // Listen for changes to configuration
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("spotlighter")) {
        // Dispose old decorations
        dimDecoration.dispose();
        normalDecoration.dispose();

        // Create new decorations with updated settings
        const decorations = getDecorationTypes();
        dimDecoration = decorations.dimDecoration;
        normalDecoration = decorations.normalDecoration;

        // Update current editor if any
        const editor = vscode.window.activeTextEditor;
        if (
          editor &&
          SUPPORTED_LANGUAGES.includes(editor.document.languageId)
        ) {
          updateDecorations(editor);
        }
      }
    })
  );

  // Initial decoration update for the active editor
  if (vscode.window.activeTextEditor) {
    const editor = vscode.window.activeTextEditor;
    if (SUPPORTED_LANGUAGES.includes(editor.document.languageId)) {
      // Check if extension is enabled before applying
      const config = vscode.workspace.getConfiguration("spotlighter");
      const isEnabled = config.get<boolean>("enabled") ?? true;

      if (isEnabled) {
        updateDecorations(editor);
      }
    }
  }

  // Also update decorations when document is saved
  const saveDisposable = vscode.workspace.onDidSaveTextDocument((document) => {
    const editor = vscode.window.activeTextEditor;
    const config = vscode.workspace.getConfiguration("spotlighter");
    const isEnabled = config.get<boolean>("enabled") ?? true;

    if (
      isEnabled &&
      editor &&
      editor.document === document &&
      SUPPORTED_LANGUAGES.includes(document.languageId)
    ) {
      updateDecorations(editor);
    }
  });

  context.subscriptions.push(saveDisposable);

  // Register a command to manually update decorations
  const updateCmd = vscode.commands.registerCommand(
    "spotlighter.updateDecorations",
    () => {
      const editor = vscode.window.activeTextEditor;
      const config = vscode.workspace.getConfiguration("spotlighter");
      const isEnabled = config.get<boolean>("enabled") ?? true;

      if (
        isEnabled &&
        editor &&
        SUPPORTED_LANGUAGES.includes(editor.document.languageId)
      ) {
        updateDecorations(editor);
      }
    }
  );

  context.subscriptions.push(updateCmd);
}

/**
 * Update decorations for a specific cursor position
 */
async function updateDecorationsForPosition(
  editor: vscode.TextEditor,
  position: vscode.Position
) {
  const doc = editor.document;

  try {
    // Get all symbols in this file
    const symbols = (await vscode.commands.executeCommand(
      "vscode.executeDocumentSymbolProvider",
      doc.uri
    )) as vscode.DocumentSymbol[] | undefined;

    if (!symbols || symbols.length === 0) {
      console.log("No symbols found in this document");
      clearAllDecorations(editor);
      return;
    }

    // Language-specific function detection
    let functionSymbol: vscode.DocumentSymbol | undefined;

    if (doc.languageId === "python") {
      functionSymbol = findEnclosingPythonFunction(doc, symbols, position);
    } else {
      // For other languages, use the standard symbol-based approach
      functionSymbol = findEnclosingFunctionSymbol(
        symbols,
        position,
        doc.languageId
      );
    }

    if (!functionSymbol) {
      // If we didn't find a function, clear decorations
      console.log("No function found at current position");
      clearAllDecorations(editor);
      return;
    }

    // Verify this is a true function, not just a variable or other declaration
    if (!isActualFunction(functionSymbol, doc.languageId)) {
      console.log("Symbol is not a function, clearing decorations");
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
    editor.setDecorations(dimDecoration, ranges);
    editor.setDecorations(normalDecoration, [functionSymbol.range]);
  } catch (err) {
    console.error("Error retrieving or parsing symbols:", err);
    clearAllDecorations(editor);
  }
}

/**
 * Check if a symbol is actually a function by examining its content
 */
function isActualFunction(
  symbol: vscode.DocumentSymbol,
  languageId: string
): boolean {
  // If it's explicitly a function or method by symbol kind, trust that
  if (
    symbol.kind === vscode.SymbolKind.Function ||
    symbol.kind === vscode.SymbolKind.Method ||
    symbol.kind === vscode.SymbolKind.Constructor
  ) {
    return true;
  }

  // For variable-like symbols, check if they span multiple lines
  // Single-line variables are unlikely to be functions
  const lineSpan = symbol.range.end.line - symbol.range.start.line;

  // If it spans multiple lines, it's more likely to be a function
  if (lineSpan > 0) {
    // For JS/TS variables that might be functions
    if (
      [
        "javascript",
        "typescript",
        "javascriptreact",
        "typescriptreact",
      ].includes(languageId)
    ) {
      if (
        symbol.kind === vscode.SymbolKind.Variable ||
        symbol.kind === vscode.SymbolKind.Field ||
        symbol.kind === vscode.SymbolKind.Property
      ) {
        return true;
      }
    }

    // For containers that might contain methods
    if (
      symbol.kind === vscode.SymbolKind.Class ||
      symbol.kind === vscode.SymbolKind.Interface ||
      symbol.kind === vscode.SymbolKind.Struct ||
      symbol.kind === vscode.SymbolKind.Module ||
      symbol.kind === vscode.SymbolKind.Namespace
    ) {
      return true;
    }
  }

  // For anything else, be conservative and don't treat as a function
  return false;
}

/**
 * Update decorations for the current cursor position
 */
async function updateDecorations(editor: vscode.TextEditor) {
  if (!editor) return;
  await updateDecorationsForPosition(editor, editor.selection.active);
}

/**
 * Special handling for Python functions which might not be properly detected
 * by the symbol provider due to indentation-based structure
 */
function findEnclosingPythonFunction(
  doc: vscode.TextDocument,
  symbols: vscode.DocumentSymbol[],
  position: vscode.Position
): vscode.DocumentSymbol | undefined {
  // First try the standard approach
  const symbolMatch = findEnclosingFunctionSymbol(symbols, position, "python");
  if (symbolMatch) return symbolMatch;

  // If that fails, try to detect Python functions by analyzing indentation
  const currentLine = position.line;

  // First check if we're inside a function definition line
  const currentLineText = doc.lineAt(currentLine).text;
  if (currentLineText.trim().startsWith("def ")) {
    // Find the symbol that corresponds to this function
    for (const sym of symbols) {
      if (
        sym.kind === vscode.SymbolKind.Function &&
        sym.range.start.line <= currentLine &&
        sym.range.end.line >= currentLine
      ) {
        return sym;
      }
    }
  }

  // Check current line indentation
  const currentIndent = getIndentation(doc.lineAt(currentLine).text);

  // Look backwards to find a function definition
  let defLine = -1;
  let defIndent = -1;

  for (let i = currentLine; i >= 0; i--) {
    const lineText = doc.lineAt(i).text;
    const lineIndent = getIndentation(lineText);

    // If this is a function definition with less indentation than current line
    if (lineText.trim().startsWith("def ") && lineIndent < currentIndent) {
      defLine = i;
      defIndent = lineIndent;
      break;
    }

    // If we hit a less indented line that's not a function, and it's not blank
    // we're probably outside the function scope
    if (
      lineIndent < currentIndent &&
      lineText.trim() &&
      !lineText.trim().startsWith("#")
    ) {
      break;
    }
  }

  if (defLine === -1) return undefined;

  // Now find where this function ends by looking for the next line with the same
  // or less indentation that's not part of the function body
  let endLine = doc.lineCount - 1;
  for (let i = defLine + 1; i < doc.lineCount; i++) {
    const lineText = doc.lineAt(i).text.trimRight();

    // Skip blank lines or comment lines
    if (!lineText || lineText.startsWith("#")) continue;

    const lineIndent = getIndentation(doc.lineAt(i).text);

    // If we find a line with indentation <= the def line's indentation,
    // we've left the function body
    if (lineIndent <= defIndent && i > currentLine) {
      endLine = i - 1;
      break;
    }
  }

  // Look for a corresponding symbol
  for (const sym of symbols) {
    if (
      sym.kind === vscode.SymbolKind.Function &&
      sym.range.start.line === defLine
    ) {
      // Update the range to our detected range if necessary
      if (sym.range.end.line < endLine) {
        return {
          ...sym,
          range: new vscode.Range(
            sym.range.start,
            doc.lineAt(endLine).range.end
          ),
        };
      }
      return sym;
    }
  }

  // If no symbol was found but we detected a function, create a synthetic one
  if (defLine !== -1) {
    const funcName = doc
      .lineAt(defLine)
      .text.trim()
      .replace("def ", "")
      .split("(")[0]
      .trim();

    return {
      name: funcName,
      detail: "",
      kind: vscode.SymbolKind.Function,
      range: new vscode.Range(
        new vscode.Position(defLine, 0),
        doc.lineAt(endLine).range.end
      ),
      selectionRange: new vscode.Range(
        new vscode.Position(defLine, 0),
        doc.lineAt(defLine).range.end
      ),
      children: [],
    };
  }

  return undefined;
}

/**
 * Get the indentation level (number of spaces) at the start of a line
 */
function getIndentation(line: string): number {
  const match = line.match(/^(\s*)/);
  return match ? match[1].length : 0;
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
    case "javascript":
    case "javascriptreact":
      // For JavaScript/TypeScript, only consider certain symbols as functions
      // Variables/fields are now checked in isActualFunction to ensure they're
      // actually functions, not just simple variable declarations
      return (
        sym.kind === vscode.SymbolKind.Class || // For class methods
        sym.kind === vscode.SymbolKind.Module // For JS modules
      );

    case "python":
      // For Python, consider classes since they might contain methods
      return (
        sym.kind === vscode.SymbolKind.Class ||
        sym.kind === vscode.SymbolKind.Module
      );

    case "go":
      // For Go, consider structs and interfaces (which contain methods)
      return (
        sym.kind === vscode.SymbolKind.Struct ||
        sym.kind === vscode.SymbolKind.Interface ||
        sym.kind === vscode.SymbolKind.Class ||
        sym.kind === vscode.SymbolKind.Namespace || // For package-level functions
        sym.kind === vscode.SymbolKind.Module // For package declarations
      );

    default:
      return false;
  }
}

/**
 * Clears all decorations in the given editor.
 */
function clearAllDecorations(editor: vscode.TextEditor) {
  editor.setDecorations(dimDecoration, []);
  editor.setDecorations(normalDecoration, []);
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
      console.log("Language ID:", editor.document.languageId);

      // Log current configuration
      const config = vscode.workspace.getConfiguration("spotlighter");
      console.log("Current configuration:", {
        enabled: config.get("enabled"),
        dimOpacity: config.get("dimOpacity"),
        dimBackground: config.get("dimBackground"),
        dimBackgroundColor: config.get("dimBackgroundColor"),
        normalOpacity: config.get("normalOpacity"),
      });

      // Log language-specific debugging info
      if (editor.document.languageId === "python") {
        logPythonDebugInfo(editor.document, editor.selection.active);
      } else if (
        [
          "javascript",
          "javascriptreact",
          "typescript",
          "typescriptreact",
        ].includes(editor.document.languageId)
      ) {
        logJsDebugInfo(symbols);
      } else if (editor.document.languageId === "go") {
        logGoDebugInfo(symbols);
      }

      // For the current cursor position, check if it's in a function
      const position = editor.selection.active;
      const functionSymbol = findEnclosingFunctionSymbol(
        symbols,
        position,
        editor.document.languageId
      );

      if (functionSymbol) {
        console.log("Current position is in symbol:", functionSymbol);
        console.log(
          "Is actual function:",
          isActualFunction(functionSymbol, editor.document.languageId)
        );
      } else {
        console.log("Current position is not in any function symbol");
      }

      vscode.window.showInformationMessage(
        `Found ${symbols?.length || 0} symbols`
      );
    }
  );

  context.subscriptions.push(debugCmd);
}

/**
 * Log Python-specific debug information
 */
function logPythonDebugInfo(
  doc: vscode.TextDocument,
  position: vscode.Position
) {
  const currentLine = position.line;
  const currentIndent = getIndentation(doc.lineAt(currentLine).text);

  console.log(`Current line: ${currentLine}, indent: ${currentIndent}`);
  console.log(`Current line text: "${doc.lineAt(currentLine).text}"`);

  // Find function definition by indentation
  let defLine = -1;
  for (let i = currentLine; i >= 0; i--) {
    const lineText = doc.lineAt(i).text;
    if (
      lineText.trim().startsWith("def ") &&
      getIndentation(lineText) < currentIndent
    ) {
      defLine = i;
      break;
    }
  }

  if (defLine !== -1) {
    console.log(
      `Found function def at line ${defLine}: "${doc.lineAt(defLine).text}"`
    );
  } else {
    console.log("No enclosing function def found by indentation analysis");
  }
}

/**
 * Log JavaScript/TypeScript-specific debug information
 */
function logJsDebugInfo(symbols: vscode.DocumentSymbol[]) {
  // Log counts of different symbol kinds to help with debugging
  const kindCounts: Record<string, number> = {};

  function countSymbolKinds(syms: vscode.DocumentSymbol[]) {
    for (const sym of syms) {
      const kind = vscode.SymbolKind[sym.kind] || sym.kind.toString();
      kindCounts[kind] = (kindCounts[kind] || 0) + 1;

      if (sym.children && sym.children.length > 0) {
        countSymbolKinds(sym.children);
      }
    }
  }

  countSymbolKinds(symbols);
  console.log("Symbol kinds found:", kindCounts);

  // Log function-like symbols
  const functionLikeSymbols = symbols.filter(
    (sym) =>
      sym.kind === vscode.SymbolKind.Function ||
      sym.kind === vscode.SymbolKind.Method ||
      sym.kind === vscode.SymbolKind.Constructor
  );

  console.log(
    `Found ${functionLikeSymbols.length} direct function-like symbols`
  );

  // Log variable declarations that might be functions
  const potentialFunctionVars = symbols.filter(
    (sym) => sym.kind === vscode.SymbolKind.Variable
  );

  console.log(
    `Found ${potentialFunctionVars.length} variables that could be functions`
  );

  // Check how many variables span multiple lines (likely functions)
  const multiLineVars = potentialFunctionVars.filter(
    (sym) => sym.range.end.line - sym.range.start.line > 0
  );

  console.log(
    `Found ${multiLineVars.length} multi-line variables (likely functions)`
  );
}

/**
 * Log Go-specific debug information
 */
function logGoDebugInfo(symbols: vscode.DocumentSymbol[]) {
  // Log counts of different symbol kinds to help with debugging
  const kindCounts: Record<string, number> = {};

  function countSymbolKinds(syms: vscode.DocumentSymbol[]) {
    for (const sym of syms) {
      const kind = vscode.SymbolKind[sym.kind] || sym.kind.toString();
      kindCounts[kind] = (kindCounts[kind] || 0) + 1;

      if (sym.children && sym.children.length > 0) {
        countSymbolKinds(sym.children);
      }
    }
  }

  countSymbolKinds(symbols);
  console.log("Symbol kinds found in Go file:", kindCounts);

  // Log function-like symbols
  const functionSymbols = symbols.filter(
    (sym) => sym.kind === vscode.SymbolKind.Function
  );

  const methodSymbols = symbols.filter(
    (sym) => sym.kind === vscode.SymbolKind.Method
  );

  console.log(`Found ${functionSymbols.length} functions`);
  console.log(`Found ${methodSymbols.length} methods`);

  // Log struct and interface declarations
  const structSymbols = symbols.filter(
    (sym) => sym.kind === vscode.SymbolKind.Struct
  );

  const interfaceSymbols = symbols.filter(
    (sym) => sym.kind === vscode.SymbolKind.Interface
  );

  console.log(`Found ${structSymbols.length} structs`);
  console.log(`Found ${interfaceSymbols.length} interfaces`);

  // Check for nested functions or methods within structs
  let nestedMethodCount = 0;
  for (const struct of structSymbols) {
    const methods = struct.children.filter(
      (child) =>
        child.kind === vscode.SymbolKind.Method ||
        child.kind === vscode.SymbolKind.Function
    );
    nestedMethodCount += methods.length;
  }

  console.log(`Found ${nestedMethodCount} methods within structs`);
}

export function deactivate() {
  // Clean up all decorations when deactivating
  if (vscode.window.activeTextEditor) {
    clearAllDecorations(vscode.window.activeTextEditor);
  }

  // Dispose of decoration types
  dimDecoration.dispose();
  normalDecoration.dispose();
}
