import React, { useState, useEffect, useRef, ChangeEvent } from 'react';
import './App.css';

interface Snippet {
  shortcut: string;
  snippet: string;
  label: string;
}

const App: React.FC = () => {
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [newShortcut, setNewShortcut] = useState<string>('');
  const [newSnippet, setNewSnippet] = useState<string>('');
  const [newLabel, setNewLabel] = useState<string>('');
  const snippetTextareaRef = useRef<HTMLTextAreaElement>(null);

  // State for inline editing
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingSnippet, setEditingSnippet] = useState<Snippet | null>(null);

  // State for search
  const [searchTerm, setSearchTerm] = useState<string>('');

  // State for feedback messages
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  useEffect(() => {
    chrome.storage.sync.get('snippets', (data) => {
      if (data.snippets && Array.isArray(data.snippets)) {
        setSnippets(data.snippets);
      }
    });
  }, []);

  const showFeedback = (message: string) => {
    setFeedbackMessage(message);
    setTimeout(() => {
      setFeedbackMessage(null);
    }, 3000); // Message disappears after 3 seconds
  };

  const updateSnippets = (updatedSnippets: Snippet[], message: string) => {
    chrome.storage.sync.set({ snippets: updatedSnippets }, () => {
      setSnippets(updatedSnippets);
      showFeedback(message);
    });
  };

  const addSnippet = (): void => {
    if (!newShortcut.trim() || !newSnippet.trim()) {
      alert('ショートカットとスニペットは空にできません。');
      return;
    }
    const newSnippets: Snippet[] = [...snippets, { shortcut: newShortcut, snippet: newSnippet, label: newLabel }];
    updateSnippets(newSnippets, 'スニペットが追加されました！');
    setNewShortcut('');
    setNewSnippet('');
    setNewLabel('');
  };

  const deleteSnippet = (index: number): void => {
    if (window.confirm('このスニペットを削除してもよろしいですか？')) {
      const newSnippets = snippets.filter((_, i) => i !== index);
      updateSnippets(newSnippets, 'スニペットが削除されました。');
    }
  };

  const startEditing = (index: number, snippet: Snippet) => {
    setEditingIndex(index);
    setEditingSnippet({ ...snippet });
  };

  const cancelEditing = () => {
    setEditingIndex(null);
    setEditingSnippet(null);
  };

  const saveEditing = (index: number) => {
    if (editingSnippet) {
      const updatedSnippets = [...snippets];
      updatedSnippets[index] = editingSnippet;
      updateSnippets(updatedSnippets, 'スニペットが更新されました！');
      cancelEditing();
    }
  };

  const handleEditChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (editingSnippet) {
      const { name, value } = e.target;
      setEditingSnippet({ ...editingSnippet, [name]: value });
    }
  };

  const handlePlaceholderSelect = (e: ChangeEvent<HTMLSelectElement>): void => {
    const placeholder = e.target.value;
    if (!placeholder || !snippetTextareaRef.current) return;

    const textarea = snippetTextareaRef.current;
    const { selectionStart, selectionEnd } = textarea;
    const text = textarea.value;
    let valueToInsert = placeholder;

    const now = new Date();
    if (placeholder === '${date}') {
      valueToInsert = now.toLocaleDateString();
    } else if (placeholder === '${time}') {
      valueToInsert = now.toLocaleTimeString();
    } else if (placeholder === '${datetime}') {
      valueToInsert = now.toLocaleString();
    }

    const newText = text.substring(0, selectionStart) + valueToInsert + text.substring(selectionEnd);
    setNewSnippet(newText);
    textarea.focus();
    e.target.value = ''; // Reset the select dropdown
  };

  const filteredSnippets = snippets.filter(snippet =>
    snippet.shortcut.toLowerCase().includes(searchTerm.toLowerCase()) ||
    snippet.snippet.toLowerCase().includes(searchTerm.toLowerCase()) ||
    snippet.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleExport = () => {
    const dataStr = JSON.stringify(snippets, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'copyx_snippets.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showFeedback('スニペットがエクスポートされました！');
  };

  const handleImport = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const importedData: Snippet[] = JSON.parse(e.target?.result as string);
          if (Array.isArray(importedData) && importedData.every(s => s.shortcut && s.snippet)) {
            updateSnippets(importedData, 'スニペットがインポートされました！');
          } else {
            alert('無効なファイル形式です。JSONファイルにはショートカットとスニペットのプロパティが必要です。');
          }
        } catch (error) {
          alert('ファイルの読み込み中にエラーが発生しました。');
          console.error('Error importing snippets:', error);
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="container">
      <h1>CopyX Snippet Manager</h1>
      {feedbackMessage && <div className="feedback-message">{feedbackMessage}</div>}
      <div className="form-container">
        <div className="form-top-row">
          <div className="form-group shortcut">
            <label htmlFor="new-shortcut">Shortcut</label>
            <input
              id="new-shortcut"
              type="text"
              placeholder="e.g., @email"
              value={newShortcut}
              onChange={(e) => setNewShortcut(e.target.value)}
            />
          </div>
          <div className="form-group label">
            <label htmlFor="new-label">Label</label>
            <input
              id="new-label"
              type="text"
              placeholder="e.g., work, personal"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
            />
          </div>
          <div className="form-group placeholder-select-group">
            <label htmlFor="placeholder-select">Options</label>
            <select id="placeholder-select" className="placeholder-select" onChange={handlePlaceholderSelect}>
              <option value="">Insert...</option>
              <option value="${cursor}">Cursor Position</option>
              <option value="${clipboard}">Clipboard Content</option>
              <option value="${date}">Current Date</option>
              <option value="${time}">Current Time</option>
              <option value="${datetime}">Current Date & Time</option>
            </select>
          </div>
        </div>
        <div className="form-group">
          <label htmlFor="new-snippet">Snippet</label>
          <textarea
            id="new-snippet"
            ref={snippetTextareaRef}
            placeholder="Snippet content..."
            value={newSnippet}
            onChange={(e) => setNewSnippet(e.target.value)}
            rows={6}
          />
        </div>
        <button className="add-button" onClick={addSnippet}>Add Snippet</button>
      </div>

      <div className="search-container">
        <input
          type="text"
          placeholder="Search snippets..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="utility-buttons">
        <button onClick={handleExport}>Export Snippets</button>
        <input type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} id="import-file" />
        <label htmlFor="import-file" className="button">Import Snippets</label>
      </div>

      <table className="snippet-table">
        <thead>
          <tr>
            <th className="col-shortcut">Shortcut</th>
            <th className="col-snippet">Snippet</th>
            <th className="col-label">Label</th>
            <th className="col-action">Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredSnippets.length > 0 ? (
            filteredSnippets.map((snippet, index) => (
              <tr key={index}>
                {editingIndex === index ? (
                  <>
                    <td><input type="text" name="shortcut" value={editingSnippet?.shortcut} onChange={handleEditChange} /></td>
                    <td><textarea name="snippet" value={editingSnippet?.snippet} onChange={handleEditChange} rows={4} /></td>
                    <td><input type="text" name="label" value={editingSnippet?.label} onChange={handleEditChange} /></td>
                    <td className="col-action">
                      <button className="action-button save-button" onClick={() => saveEditing(index)}>Save</button>
                      <button className="action-button cancel-button" onClick={cancelEditing}>Cancel</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td>{snippet.shortcut}</td>
                    <td className="snippet-content">{snippet.snippet}</td>
                    <td>{snippet.label}</td>
                    <td className="col-action">
                      <button className="action-button edit-button" onClick={() => startEditing(index, snippet)}>Edit</button>
                      <button className="action-button delete-button" onClick={() => deleteSnippet(index)}>Delete</button>
                    </td>
                  </>
                )}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={4} style={{ textAlign: 'center' }}>No snippets yet. Add one above!</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default App;
