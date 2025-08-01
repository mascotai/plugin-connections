# ElizaOS Connections Plugin

This plugin provides OAuth-based connection management for various channels within the ElizaOS ecosystem. It allows agents to authenticate with external services on the fly.

## Features

- **OAuth Authentication:** Securely connect to external services using OAuth.
- **Dynamic Credential Management:** Allows multiple agents to use the same API subscription (e.g., for Twitter).
- **Currently Supported Services:**
  - Twitter/X

## IMPORTANT

Do not add `plugin-twitter` manually to the agent/character/project file. Only add `plugin-connections`. It will add the `plugin-twitter` dynamically whenever the OAuth callback is successful.

## Twitter Developer Account Setup

To use this plugin, you need a Twitter Developer Account. You will also need to configure your Twitter App to use OAuth 1.0a and add a callback URL.

1.  **Navigate to the Twitter Developer Portal:** Go to the [Twitter Developer Portal](https://developer.twitter.com/) and log in with your developer account.
2.  **Select Your Project and App:** In the dashboard, find and select the project and the specific application you want to configure.
3.  **Go to App Settings:** Find the settings for your app. This might be labeled as "App Settings" or a settings icon (a cog).
4.  **Find Authentication Settings:** Within your app's settings, locate the "Authentication settings" section and click "Edit".
5.  **Enable 3-legged OAuth:** You will need to enable "3-legged OAuth".
6.  **Add the Callback URL:** In the "Callback URLs" or "Callback URI / Redirect URL" field, enter the following URL:

    ```
    http://localhost:3000/api/connections/twitter/callback
    ```

    Replace `http://localhost:3000` with your agent's public URL if it's deployed.

7.  **Provide a Website URL:** You will also likely need to provide a "Website URL". You can use your project's website or a placeholder.
8.  **Save Changes:** Save your settings.

## Environment Variables

Create a `.env` file in the root of your project and add the following environment variables:

```
TWITTER_API_KEY="your_twitter_api_key"
TWITTER_API_SECRET_KEY="your_twitter_api_secret_key"
```

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