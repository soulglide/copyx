import React, { useState, useEffect, useRef, ChangeEvent, useMemo } from 'react';
import './App.css';

interface Snippet {
  id: string; // Add unique ID
  shortcut: string;
  snippet: string;
  label: string;
  timestamp?: number; // Add timestamp
}

const App: React.FC = () => {
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [newShortcut, setNewShortcut] = useState<string>('');
  const [newSnippet, setNewSnippet] = useState<string>('');
  const [newLabel, setNewLabel] = useState<string>('');
  const snippetTextareaRef = useRef<HTMLTextAreaElement>(null);

  // State for inline editing
  const [editingId, setEditingId] = useState<string | null>(null); // Change to editingId
  const [editingSnippet, setEditingSnippet] = useState<Snippet | null>(null);

  // State for search
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedLabelFilter, setSelectedLabelFilter] = useState<string>(''); // New state for label filter

  // State for feedback messages
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // State for sorting
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | 'none'>('none'); // 'none' for default/no sorting, 'asc' for oldest first, 'desc' for newest first

  useEffect(() => {
    chrome.storage.local.get('snippets', (data) => {
      if (data.snippets && Array.isArray(data.snippets)) {
        // Ensure all snippets have a timestamp and ID
        const loadedSnippets = data.snippets.map((s: Snippet) => ({
          ...s,
          id: s.id || crypto.randomUUID(), // Assign new ID if missing
          timestamp: s.timestamp || Date.now() // Assign current timestamp if missing
        }));
        setSnippets(loadedSnippets);
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
    chrome.storage.local.set({ snippets: updatedSnippets }, () => {
      setSnippets(updatedSnippets);
      showFeedback(message);
    });
  };

  const addSnippet = (): void => {
    if (!newShortcut.trim() || !newSnippet.trim()) {
      alert('ショートカットとスニペットは空にできません。');
      return;
    }

    // Check for duplicate shortcuts
    if (snippets.some(snippet => snippet.shortcut === newShortcut.trim())) {
      alert('このショートカットは既に登録済みです。');
      return;
    }

    const newSnippets: Snippet[] = [...snippets, { id: crypto.randomUUID(), shortcut: newShortcut.trim(), snippet: newSnippet, label: newLabel.trim(), timestamp: Date.now() }];
    updateSnippets(newSnippets, 'スニペットが追加されました！');
    setNewShortcut('');
    setNewSnippet('');
    setNewLabel('');
  };

  const deleteSnippet = (idToDelete: string): void => { // Change to idToDelete
    if (window.confirm('このスニペットを削除してもよろしいですか？')) {
      const newSnippets = snippets.filter(snippet => snippet.id !== idToDelete); // Filter by id
      updateSnippets(newSnippets, 'スニペットが削除されました。');
    }
  };

  const startEditing = (snippet: Snippet) => { // Change to snippet directly
    setEditingId(snippet.id); // Set editingId
    setEditingSnippet({ ...snippet });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingSnippet(null);
  };

  const saveEditing = () => { // No index needed
    if (editingSnippet && editingId) {
      const updatedSnippets = snippets.map(s =>
        s.id === editingId ? editingSnippet : s // Find by id and update
      );
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
      valueToInsert = '${date}';
    } else if (placeholder === '${time}') {
      valueToInsert = '${time}';
    } else if (placeholder === '${datetime}') {
      valueToInsert = '${datetime}';
    }

    const newText = text.substring(0, selectionStart) + valueToInsert + text.substring(selectionEnd);
    setNewSnippet(newText);
    textarea.focus();
    e.target.value = ''; // Reset the select dropdown
  };

  const uniqueLabels = useMemo(() => {
    const labels = snippets.map(snippet => snippet.label).filter(label => label.trim() !== '');
    return Array.from(new Set(labels));
  }, [snippets]);

  const sortedAndFilteredSnippets = useMemo(() => {
    let tempSnippets = [...snippets];

    // Apply label filter first
    if (selectedLabelFilter) {
      tempSnippets = tempSnippets.filter(snippet => snippet.label === selectedLabelFilter);
    }

    // Apply search filter
    tempSnippets = tempSnippets.filter(snippet =>
      snippet.shortcut.toLowerCase().includes(searchTerm.toLowerCase()) ||
      snippet.snippet.toLowerCase().includes(searchTerm.toLowerCase()) ||
      snippet.label.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Apply sorting
    if (sortOrder === 'asc') {
      tempSnippets.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    } else if (sortOrder === 'desc') {
      tempSnippets.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    }

    return tempSnippets;
  }, [snippets, searchTerm, sortOrder, selectedLabelFilter]);

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
            // Ensure imported snippets have IDs
            const snippetsWithIds = importedData.map(s => ({ ...s, id: s.id || crypto.randomUUID() }));
            updateSnippets(snippetsWithIds, 'スニペットがインポートされました！');
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
      <div className="title-container">
        <h1>CopyX Snippet Manager</h1>
        <img src="/icon.jpg" alt="CopyX Icon" className="app-icon" />
      </div>
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
        <p className="shortcut-hint">enterキーを押すとスニペットが実行されます</p>
        <button className="add-button" onClick={addSnippet}>Add Snippet</button>
      </div>

      <div className="search-and-filter-container">
        <div className="search-container">
          <input
            type="text"
            placeholder="Search snippets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="filter-container">
          <label htmlFor="label-filter">Filter by Label:</label>
          <select id="label-filter" onChange={(e) => setSelectedLabelFilter(e.target.value)} value={selectedLabelFilter}>
            <option value="">All Labels</option>
            {uniqueLabels.map(label => (
              <option key={label} value={label}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="sort-container">
        <label htmlFor="sort-order">Sort by:</label>
        <select id="sort-order" onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc' | 'none')}>
          <option value="none">Default (as added)</option>
          <option value="asc">Oldest First</option>
          <option value="desc">Newest First</option>
        </select>
      </div>

      <div className="utility-buttons">
        <span className="snippet-count">Total Snippets: {snippets.length}</span>
        <button onClick={handleExport}>Export Snippets</button>
        <input type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} id="import-file" />
        <label htmlFor="import-file" className="button">Import Snippets</label>
      </div>

      <table className="snippet-table">
        <thead>
          <tr>
            <th className="col-label">Label</th>
            <th className="col-shortcut">Shortcut</th>
            <th className="col-snippet">Snippet</th>
            <th className="col-action">Actions</th>
          </tr>
        </thead>
        <tbody>
          {sortedAndFilteredSnippets.length > 0 ? (
            sortedAndFilteredSnippets.map((snippet) => (
              <tr key={snippet.id}> {/* Use snippet.id as key */}
                {editingId === snippet.id ? (
                  <>
                    <td><input type="text" name="label" value={editingSnippet?.label} onChange={handleEditChange} /></td>
                    <td><input type="text" name="shortcut" value={editingSnippet?.shortcut} onChange={handleEditChange} /></td>
                    <td><textarea name="snippet" value={editingSnippet?.snippet} onChange={handleEditChange} rows={4} /></td>
                    <td className="col-action">
                      <button className="action-button save-button" onClick={() => saveEditing()}>Save</button>
                      <button className="action-button cancel-button" onClick={cancelEditing}>Cancel</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td>{snippet.label}</td>
                    <td>{snippet.shortcut}</td>
                    <td className="snippet-content">{snippet.snippet}</td>
                    <td className="col-action">
                      <button className="action-button edit-button" onClick={() => startEditing(snippet)}>Edit</button>
                      <button className="action-button delete-button" onClick={() => deleteSnippet(snippet.id)}>Delete</button>
                    </td>
                  </>
                )}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={5} style={{ textAlign: 'center' }}>No snippets yet. Add one above!</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default App;
