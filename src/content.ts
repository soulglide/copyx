let typedBuffer = '';
let lastInputTime = Date.now();
const DEBOUNCE_TIME = 1000; // milliseconds
let snippetsCache: any[] = [];

console.log('CopyX: content.ts loaded.');

// Function to load snippets into the cache
const loadSnippets = () => {
  chrome.storage.local.get('snippets', (data) => {
    if (data.snippets) {
      snippetsCache = data.snippets;
      console.log('CopyX: Snippets loaded into cache.', snippetsCache);
    }
  });
};

// Load snippets initially
loadSnippets();

// Listen for changes in storage and reload the cache
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.snippets) {
    console.log('CopyX: Snippets have changed, reloading cache.');
    loadSnippets();
  }
});

document.addEventListener('keydown', async (event) => {
  console.log('CopyX: Keydown event detected.', event.key, 'Code:', event.code);
  const target = event.target as HTMLElement;
  const isTextInput = (target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'text') ||
                      target.tagName === 'TEXTAREA' ||
                      target.isContentEditable;

  if (!isTextInput) {
    typedBuffer = ''; // Reset buffer if not in a text input
    console.log('CopyX: Not a text input. Buffer reset.');
    return;
  }

  // Do not process or reset buffer for modifier keys
  if (event.key === 'Shift' || event.key === 'Control' || event.key === 'Alt' || event.key === 'Meta' || event.key === 'CapsLock') {
    console.log('CopyX: Modifier key pressed. Ignoring.');
    return;
  }

  const isSeparatorKey = (event.key === ' ' || event.key === 'Enter' || event.key === 'Tab');

  // Reset buffer if typing is too slow (user paused typing)
  // But don't reset if the key is a separator, to allow expansion after a pause
  if (Date.now() - lastInputTime > DEBOUNCE_TIME && !isSeparatorKey) {
    typedBuffer = '';
    console.log('CopyX: Debounce time exceeded. Buffer reset.');
  }
  lastInputTime = Date.now();

  // IME入力中は処理しない
  if (event.isComposing) {
    console.log('CopyX: IME composing. Ignoring keydown.');
    return;
  }

  // On separator key, check for snippet expansion
  if (isSeparatorKey) {
    if (typedBuffer.length === 0) {
      // Nothing in the buffer, so just let the separator key do its default action
      return;
    }

    // There is something in the buffer, so we might have a match.
    event.preventDefault();
    const bestMatch = snippetsCache.find((s: any) => s.shortcut === typedBuffer);

    if (bestMatch) {
      await replaceText(target, bestMatch, typedBuffer);
    }
    // Whether there was a match or not, the buffer should be reset
    // because a separator key was pressed, ending the current input sequence.
    typedBuffer = '';
    console.log('CopyX: Separator processed, buffer reset.');
    return; // Stop further processing
  }

  // Handle Backspace
  if (event.key === 'Backspace') {
    typedBuffer = typedBuffer.slice(0, -1); // slice on empty string is fine
    console.log('CopyX: Backspace. Buffer:', typedBuffer);
  }
  // Append printable characters
  else if (event.key.length === 1) {
    typedBuffer += event.key;
    console.log('CopyX: Appended to buffer:', typedBuffer);
  }
  // For other non-character keys (e.g., Arrow keys), do nothing.
  else {
    console.log('CopyX: Other non-character key. Not appending to buffer.');
  }
});

async function replaceText(inputElement: HTMLElement, snippet: any, typedBuffer: string) {
  console.log('CopyX: replaceText called with:', inputElement, snippet, 'typedBuffer:', typedBuffer);
  let currentText = '';
  let selectionStart = 0;
  let selectionEnd = 0;

  if (inputElement instanceof HTMLInputElement || inputElement instanceof HTMLTextAreaElement) {
    currentText = inputElement.value;
    selectionStart = inputElement.selectionStart || 0;
    selectionEnd = inputElement.selectionEnd || 0;
  } else if (inputElement.isContentEditable) {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      currentText = inputElement.innerText;
      selectionStart = range.startOffset;
      selectionEnd = range.endOffset;
    }
  }
  console.log('CopyX: Current text before replacement:', currentText);

  // Remove the typed shortcut from the current text
  // Calculate the start of the shortcut within the current text based on typedBuffer
  const shortcutStartIndexInTypedBuffer = typedBuffer.length - snippet.shortcut.length;
  const actualShortcutStart = selectionEnd - (typedBuffer.length - shortcutStartIndexInTypedBuffer);

  const textBeforeShortcut = currentText.slice(0, actualShortcutStart);
  const textAfterShortcut = currentText.slice(selectionEnd);

  let snippetText = snippet.snippet;
  console.log('CopyX: Original snippet text:', snippetText);

  const now = new Date();
  console.log('CopyX: Current time for placeholders:', now.toLocaleString());

  if (snippetText.includes('${date}')) {
    console.log('CopyX: Before date replacement:', snippetText);
    snippetText = snippetText.replace(/\${date}/g, now.toLocaleDateString());
    console.log('CopyX: After date replacement:', snippetText);
  }
  if (snippetText.includes('${time}')) {
    console.log('CopyX: Before time replacement:', snippetText);
    snippetText = snippetText.replace(/\${time}/g, now.toLocaleTimeString());
    console.log('CopyX: After time replacement:', snippetText);
  }
  if (snippetText.includes('${datetime}')) {
    console.log('CopyX: Before datetime replacement:', snippetText);
    snippetText = snippetText.replace(/\${datetime}/g, now.toLocaleString());
    console.log('CopyX: After datetime replacement:', snippetText);
  }

  if (snippetText.includes('${clipboard}')) {
    try {
      const clipboardText = await navigator.clipboard.readText();
      snippetText = snippetText.replace('${clipboard}', clipboardText);
      console.log('CopyX: Clipboard content inserted.');
    } catch (err) {
      console.error('CopyX: Failed to read clipboard contents: ', err);
    }
  }

  const cursorPlaceholderIndex = snippetText.indexOf('${cursor}');
  snippetText = snippetText.replace('${cursor}', '');

  const newText = textBeforeShortcut + snippetText + textAfterShortcut;
  console.log('CopyX: Final snippet text to insert:', snippetText);
  console.log('CopyX: New text after replacement:', newText);

  if (inputElement instanceof HTMLInputElement || inputElement instanceof HTMLTextAreaElement) {
    inputElement.value = newText;
    if (cursorPlaceholderIndex !== -1) {
      const newCursorPosition = textBeforeShortcut.length + cursorPlaceholderIndex;
      inputElement.setSelectionRange(newCursorPosition, newCursorPosition);
      console.log('CopyX: Cursor set for input/textarea at:', newCursorPosition);
    } else {
      inputElement.setSelectionRange(textBeforeShortcut.length + snippetText.length, textBeforeShortcut.length + snippetText.length);
      console.log('CopyX: Cursor set for input/textarea at end.');
    }
  } else if (inputElement.isContentEditable) {
    inputElement.innerText = newText;
    // For contenteditable, setting cursor position is more complex
    // This is a simplified approach and might need refinement for complex cases
    if (cursorPlaceholderIndex !== -1) {
      const newCursorPosition = textBeforeShortcut.length + cursorPlaceholderIndex;
      const range = document.createRange();
      const sel = window.getSelection();
      range.setStart(inputElement.firstChild || inputElement, newCursorPosition);
      range.collapse(true);
      sel?.removeAllRanges();
      sel?.addRange(range);
      console.log('CopyX: Cursor set for contenteditable at:', newCursorPosition);
    } else {
      const range = document.createRange();
      const sel = window.getSelection();
      range.setStart(inputElement.firstChild || inputElement, textBeforeShortcut.length + snippetText.length);
      range.collapse(true);
      sel?.removeAllRanges();
      sel?.addRange(range);
      console.log('CopyX: Cursor set for contenteditable at end.');
    }
  }
}
