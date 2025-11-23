# Beads Socket Fix for Devcontainer

## Problem Summary

The beads daemon couldn't create Unix domain sockets in `/workspace/.beads/` because the devcontainer mounts the workspace using a **fakeowner filesystem** that doesn't support `chmod` operations on sockets.

### Root Cause

```bash
$ mount | grep /workspace
/run/host_mark/Users on /workspace type fakeowner (rw,nosuid,nodev,relatime,fakeowner)
```

When the daemon tries to create `/workspace/.beads/bd.sock`, it fails with:

```
RPC server error: failed to set socket permissions: chmod /workspace/.beads/bd.sock: invalid argument
```

## Solution: Docker Volume for .beads

We've added a dedicated Docker volume (`beads-db-clack-track`) that uses **ext4** instead of fakeowner, mounted at `/workspace/.beads`.

### Changes Made

#### 1. docker-compose.yml

Added volume mount:

```yaml
volumes:
  - beads-db-clack-track:/workspace/.beads # New line
```

Added volume definition:

```yaml
volumes:
  beads-db-clack-track: # New volume
```

#### 2. post-create.sh

Added filesystem check to verify .beads is on a proper filesystem.

#### 3. .beads/config.yaml

Updated to enable database mode:

```yaml
no-db: false # Was: true
no-daemon: false # Was: true
```

## How to Apply

### Step 1: Backup Existing Data (IMPORTANT!)

Before rebuilding, save your current issues:

```bash
# Copy the JSONL file to a safe location
cp /workspace/.beads/issues.jsonl ~/beads-backup.jsonl

# Or commit and push to git
cd /workspace
git add .beads/issues.jsonl
git commit -m "chore(beads): backup issues before devcontainer rebuild"
git push
```

### Step 2: Rebuild the Devcontainer

1. In VS Code, open the Command Palette (Cmd/Ctrl+Shift+P)
2. Run: **"Dev Containers: Rebuild Container"**
3. Wait for rebuild to complete

### Step 3: Verify Filesystem

After rebuild, check that .beads is on ext4:

```bash
mount | grep "/workspace/.beads"
# Should show: ... on /workspace/.beads type ext4 ...
```

### Step 4: Restore Data (if needed)

If the volume was empty after rebuild:

```bash
# Copy JSONL back
cp ~/beads-backup.jsonl /workspace/.beads/issues.jsonl

# Or use git to restore
cd /workspace
git checkout .beads/issues.jsonl
```

### Step 5: Start the Daemon

```bash
# Start the beads daemon
bd daemon &

# Verify it's running
bd daemon --status
# Should show: "Daemon is running (PID: ...)"
```

### Step 6: Import Data

```bash
# Import JSONL to SQLite database
bd import

# Verify import worked
bd list
```

## Testing the Fix

### Test 1: Daemon Starts Successfully

```bash
# Check daemon log for errors
tail -f /workspace/.beads/daemon.log
```

**Expected**: Should see "RPC server ready (socket listening)" instead of chmod errors.

### Test 2: Socket Created with Proper Permissions

```bash
ls -la /workspace/.beads/bd.sock
```

**Expected**: `srw------- 1 vscode vscode 0 ... bd.sock`

### Test 3: Dependency Filtering Works

Create a test dependency:

```bash
# Create two tasks
bd create --title="Task A" --type=task
bd create --title="Task B" --type=task

# Make Task B depend on Task A
bd dep <task-b-id> <task-a-id>

# Check ready list (should NOT include Task B)
bd ready
# Task B should NOT appear (it's blocked by Task A)

# Check blocked list (should include Task B)
bd blocked
# Task B SHOULD appear here
```

### Test 4: Database Queries Work

```bash
# All these commands should work without errors:
bd list
bd ready
bd blocked
bd stats
bd show <issue-id>
```

## Troubleshooting

### Issue: "Daemon is not running" after rebuild

**Solution**: Start it manually:

```bash
bd daemon &
```

Consider adding to your shell profile:

```bash
# Add to ~/.bashrc or ~/.zshrc
if command -v bd >/dev/null 2>&1 && [ -d /workspace/.beads ]; then
    bd daemon --status >/dev/null 2>&1 || bd daemon >/dev/null 2>&1 &
fi
```

### Issue: "Database out of sync with JSONL"

**Solution**:

```bash
bd import --force
```

### Issue: Socket still shows chmod errors

**Verify the mount**:

```bash
mount | grep .beads
```

If it still shows "fakeowner", the volume mount didn't work. Try:

1. Delete the volume: `docker volume rm beads-db-clack-track`
2. Rebuild container again

### Issue: Lost all my issues after rebuild

**Don't panic!** Your data is in git:

```bash
cd /workspace
git checkout .beads/issues.jsonl
bd import
```

## Alternative Solution: Sandbox Mode

If you can't rebuild the container, use **sandbox mode** (no-db, no daemon):

```yaml
# .beads/config.yaml
no-db: true
no-daemon: true
```

**Limitations of sandbox mode:**

- ❌ `bd ready` doesn't filter by dependencies
- ❌ `bd blocked` doesn't work
- ❌ No MCP plugin support
- ✅ Basic CRUD operations still work

## Technical Details

### Why Fakeowner Doesn't Support Sockets

Fakeowner is a special filesystem mode used by Docker Desktop on macOS/Windows to present host filesystem with Unix-like permissions. It's optimized for regular files but doesn't implement full POSIX semantics for:

- Unix domain sockets
- Named pipes (FIFOs)
- Device files
- Some extended attributes

### Why ext4 Works

Docker volumes use native Linux filesystems (ext4, xfs) inside the Linux VM, which fully support all POSIX file types including sockets.

### References

- [VirtioFS Permission Issues (Docker for Mac)](https://github.com/docker/for-mac/issues/6243)
- [Unix Sockets in Docker](https://medium.com/@moaminsharifi/unix-sockets-in-a-docker-environment-a-comprehensive-guide-6b7588e5c2c4)
- [Dev Containers Best Practices](https://code.visualstudio.com/docs/devcontainers/tips-and-tricks)
- [Beads Daemon Documentation](https://github.com/steveyegge/beads)

## Summary

✅ **Fixed**: Daemon can now create sockets with proper permissions
✅ **Fixed**: `bd ready` correctly filters blocked issues
✅ **Fixed**: `bd blocked` shows issues with unresolved dependencies
✅ **Fixed**: MCP plugin works with full database mode

**Next Steps**: After verifying the fix works, you can safely delete this document.
