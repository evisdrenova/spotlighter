# Spotlighter

**Spotlighter** is a Visual Studio Code extension that dims everything outside of the current Rust function you’re editing. It helps you focus on the specific function or method under your cursor by lowering the opacity of all other code in the file.

## How It Works

- When your cursor is inside a function, Spotlighter uses Rust symbols (provided by [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)) to determine that function’s boundaries.
- It applies a “dim” decoration to everything else, so the function you’re working on stays fully visible.

## Prerequisites

1. **Visual Studio Code** – latest version recommended.
2. **rust-analyzer** – make sure you have this extension installed for Rust symbol support.
3. **Rust project layout** – typically a `Cargo.toml` and a `src/` folder so rust-analyzer can parse your code.

## Installation

If you just have this code in a Git repo and want to run the extension locally:

1. Clone orDownload the repository:

   ```bash
   git clone https://github.com/YourUser/spotlighter.git
   cd spotlighter
   ```

2. Install Dependencies:

```bash
npm install
```

3. Compile the Extension:

```bash
npm run compile
```

This will build the TypeScript source into the out/ folder.

4. Open in VS Code:

- Open the spotlighter folder in VS Code.
- Make sure your Rust codebase is in a folder with a Cargo.toml, or open a separate Rust project in another VS Code window to test.

5. Launch the Extension:

- Press F5 in VS Code, or go to the Run and Debug view and select “Run Extension”.
- A new VS Code window (the “Extension Development Host”) will open, with Spotlighter activated.

6. Using Spotlighter

- Open a Rust File in the Extension Development Host.
- Place Your Cursor inside any function.
- Observe that the code outside of the current function is dimmed, keeping your focus on the function body.

If you move your cursor outside the function or to a different function, Spotlighter updates automatically.

# Publishing or Installing a .vsix

If you create a .vsix package (via vsce package), you can install it directly in VS Code:

1. Press Cmd+Shift+P (macOS) or Ctrl+Shift+P (Windows/Linux) to open the Command Palette.
   Search for “Extensions: Install from VSIX…” and select your .vsix file.
2. Once installed, Spotlighter will be available like any other extension.

# Contributing

1. Fork the repository or clone it locally.
2. Make changes and test them by relaunching the extension (via F5).
3. Submit a pull request or share your fork.

# License

MIT License – Feel free to modify and distribute as needed.
