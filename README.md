# ElizaOS Connections Plugin

This plugin provides OAuth-based connection management for various channels within the ElizaOS ecosystem. It allows agents to authenticate with external services on the fly.

## Features

- **OAuth Authentication:** Securely connect to external services using OAuth.
- **Dynamic Credential Management:** Allows multiple agents to use the same API subscription (e.g., for Twitter).
- **Currently Supported Services:**
  - Twitter/X

## Installation

```bash
elizaos plugins add @mascotai/plugin-connections
```

## Configuration

Add the plugin to your agent's character file:

```json
{
  "plugins": ["@mascotai/plugin-connections"]
}
```

The plugin will expose a UI panel for managing connections.

## License

MIT
