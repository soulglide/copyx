let typedBuffer = '';
let lastInputTime = Date.now();
const DEBOUNCE_TIME = 1000; // milliseconds
let snippetsCache: any[] = [];

console.log('CopyX: content.ts loaded. Version 2.0');

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
  // Use document.activeElement to get the focused element, which is more reliable.
  const target = document.activeElement as HTMLElement;

  if (!target) {
    return;
  }

  const isTextInput = (target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'text') ||
                      target.tagName === 'TEXTAREA' ||
                      target.isContentEditable;

  if (!isTextInput) {
    typedBuffer = ''; // Reset buffer if not in a text input
    return;
  }

  // Do not process or reset buffer for modifier keys
  if (event.key === 'Shift' || event.key === 'Control' || event.key === 'Alt' || event.key === 'Meta' || event.key === 'CapsLock') {
    return;
  }

  const isSeparatorKey = (event.key === ' ' || event.key === 'Enter' || event.key === 'Tab');

  if (Date.now() - lastInputTime > DEBOUNCE_TIME && !isSeparatorKey) {
    typedBuffer = '';
  }
  lastInputTime = Date.now();

  if (event.isComposing) {
    return;
  }

  if (isSeparatorKey) {
    if (typedBuffer.length === 0) {
      return;
    }

    event.preventDefault();
    const bestMatch = snippetsCache.find((s: any) => s.shortcut === typedBuffer);

    if (bestMatch) {
      // Pass the matched shortcut explicitly.
      await replaceText(target, bestMatch, bestMatch.shortcut);
    }
    typedBuffer = '';
    return;
  }

  if (event.key === 'Backspace') {
    typedBuffer = typedBuffer.slice(0, -1);
  } else if (event.key.length === 1) {
    typedBuffer += event.key;
  }
});

async function replaceText(inputElement: HTMLElement, snippet: any, shortcut: string) {
  console.log(`CopyX: Replacing shortcut "${shortcut}" in`, inputElement);

  // 1. Process snippet text (placeholders)
  let snippetText = snippet.snippet;
  const now = new Date();
  snippetText = snippetText.replace(/\${date}/g, now.toLocaleDateString());
  snippetText = snippetText.replace(/\${time}/g, now.toLocaleTimeString());
  snippetText = snippetText.replace(/\${datetime}/g, now.toLocaleString());

  if (snippetText.includes('${clipboard}')) {
    try {
      const clipboardText = await navigator.clipboard.readText();
      snippetText = snippetText.replace('${clipboard}', clipboardText);
    } catch (err) {
      console.error('CopyX: Failed to read clipboard contents: ', err);
      // Keep going, just don't replace the placeholder
    }
  }

  const cursorPlaceholder = '${cursor}';
  const cursorPlaceholderIndex = snippetText.indexOf(cursorPlaceholder);
  snippetText = snippetText.replace(cursorPlaceholder, '');

  // 2. Perform replacement based on element type
  if (inputElement instanceof HTMLInputElement || inputElement instanceof HTMLTextAreaElement) {
    const selectionEnd = inputElement.selectionEnd || 0;
    const text = inputElement.value;
    const shortcutStart = selectionEnd - shortcut.length;

    if (shortcutStart < 0) {
      console.error("CopyX: Error: shortcut not found immediately before the cursor.");
      return;
    }

    const textBefore = text.slice(0, shortcutStart);
    const textAfter = text.slice(selectionEnd);

    inputElement.value = textBefore + snippetText + textAfter;

    const newCursorPosition = textBefore.length + (cursorPlaceholderIndex !== -1 ? cursorPlaceholderIndex : snippetText.length);
    inputElement.setSelectionRange(newCursorPosition, newCursorPosition);
    console.log('CopyX: Snippet inserted into input/textarea.');

  } else if (inputElement.isContentEditable) {
    console.log('CopyX: Inserting snippet into contenteditable element.');
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      console.error('CopyX: Cannot insert snippet, no selection found.');
      return;
    }

    const range = selection.getRangeAt(0);
    
    // Move the start of the range back to select the shortcut text
    range.setStart(range.startContainer, range.startOffset - shortcut.length);
    
    // Delete the selected shortcut
    range.deleteContents();

    // Insert the new snippet text
    if (cursorPlaceholderIndex !== -1) {
      const textBeforeCursor = snippetText.slice(0, cursorPlaceholderIndex);
      const textAfterCursor = snippetText.slice(cursorPlaceholderIndex);

      const afterNode = document.createTextNode(textAfterCursor);
      const beforeNode = document.createTextNode(textBeforeCursor);

      range.insertNode(afterNode);
      range.insertNode(beforeNode);

      // Position cursor in the middle
      range.setStart(afterNode, 0);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    } else {
      const snippetNode = document.createTextNode(snippetText);
      range.insertNode(snippetNode);
      
      // Position cursor at the end of the inserted text
      range.setStartAfter(snippetNode);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    }
    console.log('CopyX: Snippet inserted into contenteditable.');
  }
}