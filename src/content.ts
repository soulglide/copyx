let typedBuffer = '';
let lastInputTime = Date.now();
const DEBOUNCE_TIME = 1000; // milliseconds (increased debounce time)

console.log('CopyX: content.ts loaded.');

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

  // Reset buffer if typing is too slow (user paused typing)
  if (Date.now() - lastInputTime > DEBOUNCE_TIME) {
    typedBuffer = '';
    console.log('CopyX: Debounce time exceeded. Buffer reset.');
  }
  lastInputTime = Date.now();

  // Handle Backspace
  if (event.key === 'Backspace') {
    typedBuffer = typedBuffer.slice(0, -1);
    console.log('CopyX: Backspace. Buffer:', typedBuffer);
  }
  // Handle Space, Enter, Tab, etc. as word separators or end of input
  else if (event.key === ' ' || event.key === 'Enter' || event.key === 'Tab') {
    typedBuffer = ''; // Reset buffer for these keys
    console.log('CopyX: Separator key. Buffer reset.');
    return; // Don't append these keys to buffer
  }
  // Append printable characters
  else if (event.key.length === 1) {
    typedBuffer += event.key;
    console.log('CopyX: Appended to buffer:', typedBuffer);
  }
  // For other non-character keys (e.g., Arrow keys, Function keys), do not append but also do not reset buffer
  else {
    console.log('CopyX: Other non-character key. Not appending to buffer.');
    return;
  }

  chrome.storage.sync.get('snippets', async (data) => {
    console.log('CopyX: Fetched snippets from storage:', data.snippets);
    if (data.snippets) {
      for (const snippet of data.snippets) {
        if (typedBuffer.endsWith(snippet.shortcut)) {
          console.log('CopyX: Snippet match found!', snippet.shortcut);
          event.preventDefault(); // Prevent default keydown behavior
          await replaceText(target, snippet);
          typedBuffer = ''; // Reset buffer after expansion
          console.log('CopyX: Snippet replaced. Buffer reset.');
          break;
        }
      }
    }
  });
});

async function replaceText(inputElement: HTMLElement, snippet: any) {
  console.log('CopyX: replaceText called with:', inputElement, snippet);
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
  const textBeforeShortcut = currentText.slice(0, selectionEnd - snippet.shortcut.length);
  const textAfterShortcut = currentText.slice(selectionEnd);

  let snippetText = snippet.snippet;

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