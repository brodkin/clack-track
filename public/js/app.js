// Clack Track Web Interface

let currentContentId = null;

// Fetch and display latest content
async function loadLatestContent() {
  try {
    const response = await fetch('/api/content/latest');
    const data = await response.json();

    if (data.success && data.data) {
      displayContent(data.data);
      currentContentId = data.data.content.id;
    }
  } catch (error) {
    console.error('Failed to load content:', error);
  }
}

// Display content in Vestaboard preview
function displayContent(data) {
  const display = document.getElementById('vestaboard-display');
  const { content } = data;

  // Split text into rows (max 6 rows, 22 chars each)
  const rows = formatForVestaboard(content.text);

  display.innerHTML = rows.map(row => `<div class="vestaboard-row">${row}</div>`).join('');

  // Update timestamp
  const timestamp = new Date(content.generatedAt);
  document.getElementById('last-updated').textContent = `Updated ${timestamp.toLocaleString()}`;
}

// Format text for Vestaboard display
function formatForVestaboard(text) {
  const MAX_COLS = 22;
  const MAX_ROWS = 6;

  // Split by newlines first
  let rows = text.split('\n').slice(0, MAX_ROWS);

  // Ensure each row fits within column limit
  rows = rows.map(row => {
    if (row.length > MAX_COLS) {
      return row.substring(0, MAX_COLS);
    }
    return row.padEnd(MAX_COLS, ' ');
  });

  // Pad to 6 rows
  while (rows.length < MAX_ROWS) {
    rows.push(' '.repeat(MAX_COLS));
  }

  return rows;
}

// Submit vote
async function vote(voteType) {
  if (!currentContentId) {
    alert('No content loaded to vote on');
    return;
  }

  try {
    const response = await fetch('/api/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contentId: currentContentId,
        vote: voteType,
      }),
    });

    const data = await response.json();

    if (data.success) {
      alert(`Vote recorded: ${voteType}`);
    } else {
      alert('Failed to record vote');
    }
  } catch (error) {
    console.error('Failed to submit vote:', error);
    alert('Failed to submit vote');
  }
}

// Load content history
async function loadContentHistory() {
  try {
    const response = await fetch('/api/content/history?limit=10');
    const data = await response.json();

    if (data.success && data.data) {
      displayHistory(data.data.items);
    }
  } catch (error) {
    console.error('Failed to load history:', error);
  }
}

// Display content history
function displayHistory(items) {
  const container = document.getElementById('content-history');

  if (!items || items.length === 0) {
    container.innerHTML = '<p class="content-meta">No history available</p>';
    return;
  }

  container.innerHTML = items
    .map(
      item => `
      <div class="content-meta" style="margin-bottom: 1rem;">
        <strong>${new Date(item.generatedAt).toLocaleString()}</strong> - ${item.type}
        <br>
        <span style="font-family: monospace; font-size: 0.75rem;">${item.text.substring(0, 50)}...</span>
      </div>
    `
    )
    .join('');
}

// Load debug logs
async function loadDebugLogs() {
  try {
    const response = await fetch('/api/logs?limit=50');
    const data = await response.json();

    if (data.success && data.data) {
      displayLogs(data.data.logs);
    }
  } catch (error) {
    console.error('Failed to load logs:', error);
  }
}

// Display debug logs
function displayLogs(logs) {
  const container = document.getElementById('debug-logs');

  if (!logs || logs.length === 0) {
    container.innerHTML = '<div class="log-entry info">[INFO] No logs available</div>';
    return;
  }

  container.innerHTML = logs
    .map(
      log => `
      <div class="log-entry ${log.level}">
        [${log.level.toUpperCase()}] ${new Date(log.timestamp).toLocaleTimeString()} - ${log.message}
      </div>
    `
    )
    .join('');
}

// Refresh logs
function refreshLogs() {
  loadDebugLogs();
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadLatestContent();
  loadContentHistory();
  loadDebugLogs();

  // Auto-refresh every 60 seconds
  setInterval(() => {
    loadLatestContent();
    loadDebugLogs();
  }, 60000);
});
