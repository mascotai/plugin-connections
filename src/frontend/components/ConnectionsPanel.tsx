import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { UUID } from "@elizaos/core";
import { Button } from "./ui/button";
import { Spinner } from "./ui/spinner";
import { Twitter } from "lucide-react";

interface Connection {
  service: string;
  serviceName: string;
  isConnected: boolean;
  isPending: boolean; // Add this
  username?: string;
  userId?: string;
  displayName: string;
  icon: string;
  color: string;
  description: string;
  lastChecked: string;
}

interface ConnectionsResponse {
  agentId: UUID;
  connections: Connection[];
  lastUpdated: string;
}

interface ConnectionsPanelProps {
  agentId: UUID;
}

export const ConnectionsPanel: React.FC<ConnectionsPanelProps> = ({
  agentId,
}) => {
  const queryClient = useQueryClient();
  const [isConnecting, setIsConnecting] = useState<boolean>(false);

  

  // Fetch Twitter connection status only
  const {
    data: connectionsData,
    isLoading: isLoadingStatus,
    error: statusError,
  } = useQuery<ConnectionsResponse>({
    queryKey: ["connections", agentId],
    queryFn: async () => {
      const response = await fetch(`/api/connections?agentId=${agentId}`);
      if (!response.ok) {
        // If API fails, return null so we show default disconnected state
        return null;
      }
      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
    retry: false, // Don't retry on failure, just show disconnected
  });

  // Disconnect mutation
  const disconnectMutation = useMutation({
    mutationFn: async (service: string) => {
      console.log('Starting disconnect mutation for service:', service);
      console.log('Agent ID:', agentId);
      
      const response = await fetch(
        `/api/connections/${service}/disconnect`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ agentId }),
        },
      );

      console.log('Disconnect response status:', response.status);
      console.log('Disconnect response ok:', response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Disconnect failed with response:', errorText);
        throw new Error(`Failed to disconnect from ${service}: ${errorText}`);
      }

      const result = await response.json();
      console.log('Disconnect successful:', result);
      return result;
    },
    onSuccess: () => {
      console.log('Disconnect mutation successful, invalidating queries');
      queryClient.invalidateQueries({ queryKey: ["connections", agentId] });
    },
    onError: (error) => {
      console.error('Disconnect mutation failed:', error);
    },
  });

  // Test connection mutation
  const testConnectionMutation = useMutation({
    mutationFn: async (service: string) => {
      const response = await fetch(
        `/api/connections/${service}/test?agentId=${agentId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to test ${service} connection`);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["connections", agentId] });
    },
  });

  const handleConnect = async (service: string) => {
    setIsConnecting(true);

    try {
      const response = await fetch(
        `/api/connections/${service}/connect`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            agentId,
            returnUrl: window.location.href,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to initiate ${service} connection`);
      }

      const data = await response.json();

      // Open OAuth URL in new window if provided
      if (data.authUrl) {
        // Store state for return handling
        if (data.state) {
          sessionStorage.setItem('oauth_state', data.state);
        }
        
        // Open OAuth in new window/tab to avoid iframe restrictions
        const authWindow = window.open(
          data.authUrl,
          'oauth_popup',
          'width=600,height=700,scrollbars=yes,resizable=yes'
        );
        
        // Monitor the popup for completion
        const checkClosed = setInterval(() => {
          if (authWindow?.closed) {
            clearInterval(checkClosed);
            setIsConnecting(false);
            // Refresh connection status after OAuth completes
            queryClient.invalidateQueries({
              queryKey: ["connections", agentId],
            });
          }
        }, 1000);
        
        // Also listen for message from popup (if callback posts back)
        const messageListener = (event: MessageEvent) => {
          if (event.origin !== window.location.origin) {
            return;
          }
          
          if (event.data.type === 'OAUTH_SUCCESS') {
            authWindow?.close();
            clearInterval(checkClosed);
            setIsConnecting(false);
            queryClient.invalidateQueries({
              queryKey: ["connections", agentId],
            });
            window.removeEventListener('message', messageListener);
          }
        };
        
        window.addEventListener('message', messageListener);
        
        // Cleanup if still connecting after 5 minutes
        setTimeout(() => {
          if (authWindow && !authWindow.closed) {
            authWindow.close();
          }
          clearInterval(checkClosed);
          setIsConnecting(false);
          window.removeEventListener('message', messageListener);
        }, 300000); // 5 minutes
        
      } else {
        // No auth URL provided, reset connecting state
        setIsConnecting(false);
      }
    } catch (error) {
      console.error(`${service} connection failed:`, error);
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async (service: string) => {
    console.log('Disconnect button clicked for service:', service);
    console.log('Proceeding with disconnect (confirmation dialog removed)...');
    disconnectMutation.mutate(service);
  };

  const handleTest = async (service: string) => {
    testConnectionMutation.mutate(service);
  };

  // Skip loading and error states - go straight to connections component

  const connections = connectionsData?.connections || [];

  // Only render if we have connection data
  if (connections.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6 p-6">
      {connections.map((connection) => (
        <ConnectionCard
          key={connection.service}
          connection={connection}
          onConnect={() => handleConnect(connection.service)}
          onDisconnect={() => handleDisconnect(connection.service)}
          onTest={() => handleTest(connection.service)}
          isConnecting={isConnecting}
          isDisconnecting={disconnectMutation.isPending}
          isTesting={testConnectionMutation.isPending}
          isPending={connection.isPending}
        />
      ))}
    </div>
  );
};

interface ConnectionCardProps {
  connection: Connection;
  onConnect: () => void;
  onDisconnect: () => void;
  onTest: () => void;
  isConnecting: boolean;
  isDisconnecting: boolean;
  isTesting: boolean;
  isPending: boolean;
}

const ConnectionCard: React.FC<ConnectionCardProps> = ({
  connection,
  onConnect,
  onDisconnect,
  onTest,
  isConnecting,
  isDisconnecting,
  isTesting,
  isPending,
}) => {
  const getStatusBadge = (isConnected: boolean, isPending: boolean) => {
    if (isPending) {
      return (
        <span className="text-xs px-2 py-0.5 rounded bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400">
          Pending Restart
        </span>
      );
    }
    return isConnected ? (
      <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
        Connected
      </span>
    ) : (
      <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400">
        Disconnected
      </span>
    );
  };

  const getServiceIcon = (service: string) => {
    const iconProps = { className: "h-4 w-4" };

    switch (service) {
      case "twitter":
        return <Twitter {...iconProps} />;
      default:
        return <Twitter {...iconProps} />;
    }
  };

  return (
    <div className="border rounded-lg p-4 bg-card hover:bg-accent/5 transition-colors group">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-md bg-muted">
            {getServiceIcon(connection.service)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">
                {connection.displayName}
              </span>
              {getStatusBadge(connection.isConnected, isPending)}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {connection.isConnected || isPending ? (
            <Button
              onClick={onDisconnect}
              disabled={isDisconnecting}
              className="w-[120px] opacity-50 hover:opacity-100"
            >
              {isDisconnecting ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Disconnecting...
                </>
              ) : (
                "Disconnect"
              )}
            </Button>
          ) : (
            <Button
              onClick={onConnect}
              disabled={isConnecting}
              className="w-[120px]"
            >
              {isConnecting ? (
                <>
                  <Spinner size="sm" className="mr-2" />
                  Connecting...
                </>
              ) : (
                "Connect"
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
