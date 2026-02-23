/**
 * Shared message handler logic for RN↔WebView bridge.
 * Injected into both xterm and ghostty HTML templates.
 */
const HANDLE_MSG_JS = `
    function handleMsg(e) {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'write') term.write(msg.data);
        if (msg.type === 'clear') { term.clear(); term.reset(); }
        if (msg.type === 'info') term.writeln('\\x1b[36m' + msg.text + '\\x1b[0m');
        if (msg.type === 'error') term.writeln('\\x1b[31m' + msg.text + '\\x1b[0m');
      } catch { /* malformed JSON from RN bridge — safe to ignore */ }
    }
    window.addEventListener('message', handleMsg);
    document.addEventListener('message', handleMsg);
`;

export const XTERM_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@xterm/xterm@5.5.0/css/xterm.min.css">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { height: 100%; background: #1a1a2e; overflow: hidden; }
    #terminal { height: 100%; width: 100%; }
    .xterm { height: 100%; }
  </style>
</head>
<body>
  <div id="terminal"></div>
  <script src="https://cdn.jsdelivr.net/npm/@xterm/xterm@5.5.0/lib/xterm.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/@xterm/addon-fit@0.10.0/lib/addon-fit.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/@xterm/addon-web-links@0.11.0/lib/addon-web-links.min.js"></script>
  <script>
    const term = new Terminal({
      theme: {
        background: '#1a1a2e',
        foreground: '#e4e4e7',
        cursor: '#10A37F',
        cursorAccent: '#1a1a2e',
        selectionBackground: 'rgba(16, 163, 127, 0.3)',
        black: '#1a1a2e', red: '#ef4444', green: '#10A37F', yellow: '#f59e0b',
        blue: '#3b82f6', magenta: '#a855f7', cyan: '#06b6d4', white: '#e4e4e7',
      },
      fontSize: 13,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      cursorBlink: true,
      cursorStyle: 'bar',
      scrollback: 5000,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon.FitAddon();
    const webLinksAddon = new WebLinksAddon.WebLinksAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.open(document.getElementById('terminal'));
    fitAddon.fit();

    // Send user input to React Native
    term.onData((data) => {
      window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'input', data }));
    });

    // Report resize
    new ResizeObserver(() => {
      fitAddon.fit();
      window.ReactNativeWebView?.postMessage(JSON.stringify({
        type: 'resize', cols: term.cols, rows: term.rows
      }));
    }).observe(document.getElementById('terminal'));

    ${HANDLE_MSG_JS}

    term.writeln('\\x1b[1;36m╔══════════════════════════════════════╗\\x1b[0m');
    term.writeln('\\x1b[1;36m║   Agentic Remote Terminal            ║\\x1b[0m');
    term.writeln('\\x1b[1;36m╚══════════════════════════════════════╝\\x1b[0m');
    term.writeln('');
    term.writeln('Tap \\x1b[32m+ New Shell\\x1b[0m or select a tmux session.');
    term.writeln('');

    window.ReactNativeWebView?.postMessage(JSON.stringify({
      type: 'ready', cols: term.cols, rows: term.rows
    }));
  </script>
</body>
</html>
`;

// ghostty-web uses same API as xterm.js but WASM-compiled VT100 parser
export const GHOSTTY_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { height: 100%; background: #1a1a2e; overflow: hidden; }
    #terminal { height: 100%; width: 100%; }
    .xterm { height: 100%; }
  </style>
</head>
<body>
  <div id="terminal"></div>
  <script type="module">
    import { init, Terminal } from 'https://esm.sh/ghostty-web@latest';

    await init();

    const term = new Terminal({
      theme: {
        background: '#1a1a2e',
        foreground: '#e4e4e7',
        cursor: '#10A37F',
        cursorAccent: '#1a1a2e',
        selectionBackground: 'rgba(16, 163, 127, 0.3)',
        black: '#1a1a2e', red: '#ef4444', green: '#10A37F', yellow: '#f59e0b',
        blue: '#3b82f6', magenta: '#a855f7', cyan: '#06b6d4', white: '#e4e4e7',
      },
      fontSize: 13,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      cursorBlink: true,
      scrollback: 5000,
    });

    term.open(document.getElementById('terminal'));

    // FitAddon-like behavior: resize on container changes
    function fitTerminal() {
      const container = document.getElementById('terminal');
      const charWidth = 8;
      const charHeight = 16;
      const cols = Math.floor(container.clientWidth / charWidth);
      const rows = Math.floor(container.clientHeight / charHeight);
      if (cols > 0 && rows > 0) term.resize(cols, rows);
    }
    fitTerminal();

    term.onData((data) => {
      window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'input', data }));
    });

    new ResizeObserver(() => {
      fitTerminal();
      window.ReactNativeWebView?.postMessage(JSON.stringify({
        type: 'resize', cols: term.cols, rows: term.rows
      }));
    }).observe(document.getElementById('terminal'));

    ${HANDLE_MSG_JS}

    term.writeln('\\x1b[1;35m╔══════════════════════════════════════╗\\x1b[0m');
    term.writeln('\\x1b[1;35m║   Agentic Terminal (Ghostty)         ║\\x1b[0m');
    term.writeln('\\x1b[1;35m╚══════════════════════════════════════╝\\x1b[0m');
    term.writeln('');
    term.writeln('Powered by \\x1b[35mghostty-web\\x1b[0m WASM terminal emulator.');
    term.writeln('Tap \\x1b[32m+ New Shell\\x1b[0m or select a tmux session.');
    term.writeln('');

    window.ReactNativeWebView?.postMessage(JSON.stringify({
      type: 'ready', cols: term.cols, rows: term.rows
    }));
  </script>
</body>
</html>
`;
