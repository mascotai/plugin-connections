import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import React from "react";
import type { UUID } from "@elizaos/core";
import { ConnectionsPanel } from "./components/ConnectionsPanel";
import { ThemeProvider } from "./components/theme-provider";
import "./globals.css";

const queryClient = new QueryClient();

// Define the interface for the ELIZA_CONFIG
interface ElizaConfig {
  agentId: string;
  apiBase: string;
}

// Declare global window extension for TypeScript
declare global {
  interface Window {
    ELIZA_CONFIG?: ElizaConfig;
  }
}

/**
 * Main Application route component
 */
function AppRoute() {
  const config = window.ELIZA_CONFIG;
  const agentId = config?.agentId;

  if (!agentId) {
    return (
      <div>
        <div>Error: Agent ID not found</div>
        <div>The server should inject the agent ID configuration.</div>
      </div>
    );
  }

  return <AppProvider agentId={agentId as UUID} />;
}

/**
 * Main app provider component
 */
function AppProvider({ agentId }: { agentId: UUID }) {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="eliza-ui-theme">
      <QueryClientProvider client={queryClient}>
        <div
          className="min-h-screen"
          style={{ backgroundColor: "hsl(var(--background))" }}
        >
          <main>
            <ConnectionsPanel agentId={agentId} />
          </main>
        </div>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

// Initialize the application - no router needed for iframe
const rootElement = document.getElementById("root");
if (rootElement) {
  createRoot(rootElement).render(<AppRoute />);
}

// Define types for integration with agent UI system
export interface AgentPanel {
  name: string;
  path: string;
  component: React.ComponentType<any>;
  icon?: string;
  public?: boolean;
  shortLabel?: string; // Optional short label for mobile
}

interface PanelProps {
  agentId: string;
}

/**
 * Twitter connections panel component for the plugin system
 */
const TwitterConnectionsPanel: React.FC<PanelProps> = ({ agentId }) => {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="eliza-ui-theme">
      <QueryClientProvider client={queryClient}>
        <div
          className="min-h-screen"
          style={{ backgroundColor: "hsl(var(--background))" }}
        >
          <main>
            <ConnectionsPanel agentId={agentId as UUID} />
          </main>
        </div>
      </QueryClientProvider>
    </ThemeProvider>
  );
};

// Export the panel configuration for integration with the agent UI
export const panels: AgentPanel[] = [
  {
    name: "Twitter Connections",
    path: "twitter-connections",
    component: TwitterConnectionsPanel,
    icon: "Link",
    public: false,
    shortLabel: "Twitter",
  },
];

export * from "./utils";
