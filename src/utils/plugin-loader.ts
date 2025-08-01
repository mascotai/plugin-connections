import { type IAgentRuntime, logger } from "@elizaos/core";

/**
 * Dynamically updates runtime settings and loads or reloads a plugin.
 * @param runtime The agent runtime instance.
 * @param settingsToUpdate A map of runtime settings to update.
 * @param pluginPackageName The npm package name of the plugin to load.
 */
export async function updateAndRegisterPlugin(
  runtime: IAgentRuntime,
  settingsToUpdate: Record<string, any>,
  pluginPackageName: string,
) {
  if (Object.values(settingsToUpdate).some((value) => !!value)) {
    logger.info(`Attempting to dynamically load/reload ${pluginPackageName}...`);
    try {
      // Inject the credentials into the runtime for the plugin to use.
      for (const [key, value] of Object.entries(settingsToUpdate)) {
        runtime.setSetting(key, value);
      }

      const { default: plugin } = await import(pluginPackageName);
      await runtime.registerPlugin(plugin as any);
      logger.info(`Successfully loaded/reloaded ${pluginPackageName}.`);
    } catch (error) {
      logger.error(`Failed to dynamically load/reload ${pluginPackageName}`, error);
    }
  } else {
    logger.info(
      `No valid credentials found for ${pluginPackageName}. Skipping plugin load.`,
    );
  }
}
