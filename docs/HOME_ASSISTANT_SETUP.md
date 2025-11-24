# Home Assistant Integration Setup Guide

This guide provides step-by-step instructions for creating and configuring a Home Assistant long-lived access token for Clack Track integration.

## Overview

Clack Track integrates with Home Assistant to enable event-driven content updates on your Vestaboard. When configured, your Vestaboard can automatically display new content based on Home Assistant events like:

- Person arriving home
- Door opening/closing
- Weather changes
- Custom automation triggers

The integration uses Home Assistant's WebSocket API with long-lived access tokens for secure, persistent connections.

## Prerequisites

- Home Assistant instance running and accessible on your network
- User account with appropriate permissions in Home Assistant
- Network connectivity between Clack Track and Home Assistant

## Step 1: Create Long-Lived Access Token

### Navigate to Your Profile

1. Open your Home Assistant web interface (typically `http://homeassistant.local:8123`)
2. Log in with your credentials
3. Click your **username** in the bottom left corner of the sidebar
4. This opens your **Profile** page

### Generate the Token

1. Scroll down to the **Long-Lived Access Tokens** section
2. Click the **CREATE TOKEN** button at the bottom of the section
3. Enter a descriptive name for the token:
   - **Recommended:** `Clack Track Integration`
   - This helps you identify the token's purpose later
4. Click **OK** to generate the token

### Copy Your Token (CRITICAL)

**⚠️ IMPORTANT:** The token will only be displayed ONCE. You cannot view it again after closing the dialog.

1. A dialog will appear showing your new token (starts with `eyJ...`)
2. Click the **COPY** button or manually select and copy the entire token
3. Store it somewhere safe temporarily (you'll add it to your `.env` file next)
4. Click **OK** to close the dialog

**Security Note:** If you lose the token, you'll need to create a new one and revoke the old one.

## Step 2: Configure Clack Track

### Add to Environment Variables

1. Open your `.env` file in the Clack Track project directory
2. Add or update the following variables:

```bash
# Home Assistant Integration
# WebSocket URL - typically ws://IP:8123/api/websocket
HOME_ASSISTANT_URL=ws://homeassistant.local:8123/api/websocket
# Long-lived access token from Step 1
HOME_ASSISTANT_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Optional: Reconnection Settings
# HOME_ASSISTANT_RECONNECT_DELAY=5000
# HOME_ASSISTANT_MAX_RECONNECT_ATTEMPTS=10
```

### URL Format Examples

**Local Network (Recommended):**

```bash
# Using hostname (if mDNS is configured)
HOME_ASSISTANT_URL=ws://homeassistant.local:8123/api/websocket

# Using IP address
HOME_ASSISTANT_URL=ws://192.168.1.100:8123/api/websocket
```

**Remote Access (Advanced):**

```bash
# Using Nabu Casa Cloud or custom domain with HTTPS
HOME_ASSISTANT_URL=wss://your-instance.ui.nabu.casa/api/websocket

# Self-hosted with SSL
HOME_ASSISTANT_URL=wss://homeassistant.yourdomain.com/api/websocket
```

**Protocol Notes:**

- Use `ws://` for unencrypted local connections (most common)
- Use `wss://` for encrypted connections (required for remote access)

## Step 3: Test Connectivity

### Basic Connection Test

Test that Clack Track can connect to Home Assistant:

```bash
npm run test:ha
```

**Expected Output (Success):**

```
🏠 Home Assistant Connectivity Test

1. Testing connection...
   ✓ Connected successfully (245ms)
   ✓ Connection validated (latency: 12ms)

✓ Testing complete
```

### List All Entities

Discover what entities are available in your Home Assistant:

```bash
npm run test:ha -- --list
```

**Example Output:**

```
2. Listing all entities...
   ✓ Found 142 entities

   automation (12)
     automation.front_door_notification = on
     automation.morning_routine = on
     ... and 10 more

   light (8)
     light.living_room = off
     light.bedroom = on
     ... and 6 more

   person (2)
     person.alice = home
     person.bob = away
```

### Query Specific Entity

Get detailed information about a specific entity:

```bash
npm run test:ha -- --entity person.alice
```

**Example Output:**

```
2. Getting state for entity: person.alice

   ✓ Entity found

   Entity ID:    person.alice
   State:        home
   Last Updated: 2025-11-24T10:30:15.123Z
   Last Changed: 2025-11-24T10:30:15.123Z

   Attributes:
     friendly_name = Alice
     latitude = 37.7749
     longitude = -122.4194
     source = device_tracker.alice_phone
```

### Watch Real-Time Events

Monitor Home Assistant events in real-time (30 seconds):

```bash
npm run test:ha -- --watch state_changed
```

This is useful for understanding what events fire when you interact with your Home Assistant instance.

## Token Permissions

### What Can the Token Access?

Long-lived access tokens inherit the permissions of the user account that created them. By default, this includes:

**Read Access:**

- Entity states (sensors, switches, lights, etc.)
- Entity attributes
- Home Assistant configuration
- Event stream

**Write Access:**

- Service calls (turn on/off devices)
- State changes (if authorized)
- Automation triggers

### Recommended Permissions

For Clack Track, you typically need:

- ✅ **Read access to entity states** (required for event monitoring)
- ✅ **Subscribe to events** (required for event-driven updates)
- ⚠️ **Service calls** (optional - only needed if triggering automations)

### Creating Limited Access Users (Advanced)

For enhanced security, create a dedicated user for Clack Track:

1. Go to **Settings** → **People** → **ADD PERSON**
2. Create user: `clack-track-integration`
3. Assign only required permissions
4. Generate token from this limited account

This follows the principle of least privilege - the integration only gets access to what it needs.

## Security Best Practices

### Token Storage

**✅ DO:**

- Store tokens in environment variables (`.env` file)
- Add `.env` to `.gitignore` (already configured in this project)
- Use secure secret managers in production (AWS Secrets Manager, Azure Key Vault, etc.)

**❌ DON'T:**

- Commit tokens to version control
- Share tokens in chat, email, or screenshots
- Hardcode tokens in source files

### Token Rotation

**Recommended Schedule:**

- Rotate tokens every **90 days** for security
- Rotate immediately if token may have been exposed
- Rotate when team members with access leave

**Rotation Process:**

1. Create new token (Step 1)
2. Update `.env` with new token
3. Test connectivity with new token
4. Revoke old token in Home Assistant

### Revoke Compromised Tokens

If a token is compromised:

1. Go to **Profile** → **Long-Lived Access Tokens**
2. Find the compromised token in the list
3. Click **DELETE** next to the token
4. Create and configure a new token immediately

### Network Security

**Recommendations:**

- Use `ws://` only on trusted local networks
- Use `wss://` for any remote access
- Consider firewall rules to restrict access to port 8123
- Use VPN for remote access instead of exposing Home Assistant to internet

## Environment Configuration Reference

### Required Variables

| Variable               | Description             | Example                                       |
| ---------------------- | ----------------------- | --------------------------------------------- |
| `HOME_ASSISTANT_URL`   | WebSocket API endpoint  | `ws://homeassistant.local:8123/api/websocket` |
| `HOME_ASSISTANT_TOKEN` | Long-lived access token | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`     |

### Optional Variables

| Variable                                | Description                         | Default |
| --------------------------------------- | ----------------------------------- | ------- |
| `HOME_ASSISTANT_RECONNECT_DELAY`        | Delay between reconnection attempts | `5000`  |
| `HOME_ASSISTANT_MAX_RECONNECT_ATTEMPTS` | Maximum reconnection attempts       | `10`    |

### Complete Example

```bash
# Required Configuration
HOME_ASSISTANT_URL=ws://192.168.1.50:8123/api/websocket
HOME_ASSISTANT_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiI4ZjY...

# Optional: Customize reconnection behavior
HOME_ASSISTANT_RECONNECT_DELAY=3000
HOME_ASSISTANT_MAX_RECONNECT_ATTEMPTS=20
```

## Troubleshooting

### Authentication Errors

**Error:** `HAAuthenticationError: Home Assistant authentication failed`

**Causes:**

- Invalid or expired token
- Token revoked in Home Assistant
- Token from different Home Assistant instance

**Solutions:**

1. Verify token is copied correctly (no extra spaces or line breaks)
2. Create a new token and update `.env`
3. Ensure URL matches the Home Assistant instance where token was created

**Test Command:**

```bash
npm run test:ha
```

### Connection Errors

**Error:** `ConnectionError: Home Assistant connection failed: ECONNREFUSED`

**Causes:**

- Home Assistant not running
- Incorrect URL or IP address
- Network connectivity issues
- Firewall blocking port 8123

**Solutions:**

1. Verify Home Assistant is accessible in browser
2. Check URL format: `ws://` for local, `wss://` for remote
3. Try IP address instead of hostname (or vice versa)
4. Ping the Home Assistant host: `ping homeassistant.local`
5. Check firewall allows outbound connections to port 8123

**Test Network Connectivity:**

```bash
# Test basic connectivity
ping homeassistant.local

# Test port accessibility (requires netcat)
nc -zv homeassistant.local 8123
```

### Entity Not Found

**Error:** `StateQueryError: Entity not found: light.living_room`

**Causes:**

- Typo in entity ID
- Entity renamed or removed in Home Assistant
- Entity belongs to disabled integration

**Solutions:**

1. List all entities to find correct ID:
   ```bash
   npm run test:ha -- --list
   ```
2. Check entity exists in Home Assistant UI
3. Verify entity is not disabled

### WebSocket Protocol Errors

**Error:** `Error: Invalid WebSocket protocol`

**Causes:**

- Using `http://` or `https://` instead of `ws://` or `wss://`
- Missing `/api/websocket` path

**Solutions:**

1. Verify URL format:
   - ✅ `ws://homeassistant.local:8123/api/websocket`
   - ❌ `http://homeassistant.local:8123`
   - ❌ `ws://homeassistant.local:8123` (missing path)

### Reconnection Issues

**Symptom:** Connection drops frequently and doesn't reconnect

**Solutions:**

1. Increase reconnection delay:
   ```bash
   HOME_ASSISTANT_RECONNECT_DELAY=10000
   ```
2. Increase max attempts:
   ```bash
   HOME_ASSISTANT_MAX_RECONNECT_ATTEMPTS=20
   ```
3. Check Home Assistant logs for connection issues:
   - Settings → System → Logs

### Permission Denied Errors

**Error:** `Unauthorized` when calling services

**Causes:**

- Token user lacks required permissions
- Service requires admin access

**Solutions:**

1. Create token from admin account
2. Grant required permissions to token user
3. Check Home Assistant configuration.yaml for access restrictions

## Integration Usage Examples

### Event-Driven Updates

Subscribe to Home Assistant events to trigger Vestaboard updates:

```typescript
import { HomeAssistantClient } from '@/api/data-sources/home-assistant.js';

const client = new HomeAssistantClient({
  url: process.env.HOME_ASSISTANT_URL!,
  token: process.env.HOME_ASSISTANT_TOKEN!,
});

await client.connect();

// Subscribe to state changes
await client.subscribeToEvents('state_changed', event => {
  if (event.data.entity_id === 'person.alice') {
    if (event.data.new_state.state === 'home') {
      // Trigger welcome message on Vestaboard
      console.log('Alice arrived home!');
    }
  }
});
```

### Query Entity States

Get current state of entities for content generation:

```typescript
// Get weather sensor
const weather = await client.getState('weather.home');
console.log(`Temperature: ${weather.attributes.temperature}°F`);

// Get all lights
const states = await client.getAllStates();
const lights = states.filter(s => s.entity_id.startsWith('light.'));
console.log(`${lights.length} lights are configured`);
```

### Call Services

Trigger Home Assistant automations or control devices:

```typescript
// Turn on a light
await client.callService('light', 'turn_on', {
  entity_id: 'light.living_room',
  brightness: 255,
});

// Trigger automation
await client.callService('automation', 'trigger', {
  entity_id: 'automation.vestaboard_update',
});
```

## Advanced Configuration

### Multiple Home Assistant Instances

If you need to connect to multiple Home Assistant instances:

```bash
# Primary instance
HOME_ASSISTANT_URL=ws://home1.local:8123/api/websocket
HOME_ASSISTANT_TOKEN=token_for_instance_1

# Secondary instance (requires code changes)
# Store in different environment variables
HA_SECONDARY_URL=ws://home2.local:8123/api/websocket
HA_SECONDARY_TOKEN=token_for_instance_2
```

### Custom Reconnection Strategy

For unreliable networks, customize reconnection behavior:

```bash
# Aggressive reconnection (unstable networks)
HOME_ASSISTANT_RECONNECT_DELAY=1000
HOME_ASSISTANT_MAX_RECONNECT_ATTEMPTS=50

# Conservative reconnection (stable networks)
HOME_ASSISTANT_RECONNECT_DELAY=30000
HOME_ASSISTANT_MAX_RECONNECT_ATTEMPTS=5

# Disable automatic reconnection
HOME_ASSISTANT_MAX_RECONNECT_ATTEMPTS=0
```

### State Caching (Performance Optimization)

Enable caching to reduce API calls (requires code configuration):

```typescript
const client = new HomeAssistantClient({
  url: process.env.HOME_ASSISTANT_URL!,
  token: process.env.HOME_ASSISTANT_TOKEN!,
  stateCache: {
    enabled: true,
    ttlMs: 5000, // Cache states for 5 seconds
  },
});
```

## Additional Resources

### Official Documentation

- [Home Assistant Long-Lived Access Tokens](https://www.home-assistant.io/docs/authentication/)
- [Home Assistant WebSocket API](https://developers.home-assistant.io/docs/api/websocket/)
- [Home Assistant RESTful API](https://developers.home-assistant.io/docs/api/rest/)

### Home Assistant Community

- [Home Assistant Community Forum](https://community.home-assistant.io/)
- [Home Assistant Discord](https://www.home-assistant.io/join-chat/)

### Clack Track Documentation

- [AI Provider Setup](./ai-providers.md)
- [Vestaboard Configuration](../README.md#vestaboard-configuration)

## Getting Help

If you encounter issues not covered in this guide:

1. **Check Clack Track Logs:** Look for detailed error messages in console output
2. **Check Home Assistant Logs:** Settings → System → Logs
3. **Test Connectivity:** Run `npm run test:ha` for diagnostics
4. **Check Network:** Verify Home Assistant is accessible from the Clack Track host
5. **Create GitHub Issue:** Include error messages, test output, and configuration (without sensitive tokens)

## Summary Checklist

Before considering setup complete, verify:

- [ ] Long-lived access token created in Home Assistant
- [ ] Token copied and stored securely
- [ ] `HOME_ASSISTANT_URL` configured in `.env`
- [ ] `HOME_ASSISTANT_TOKEN` configured in `.env`
- [ ] Connection test passes: `npm run test:ha`
- [ ] Entity listing works: `npm run test:ha -- --list`
- [ ] Token permissions are appropriate (read access minimum)
- [ ] Security best practices followed (no token in git)
- [ ] Token rotation schedule established (recommended: 90 days)

Once all items are checked, your Home Assistant integration is ready to use!
