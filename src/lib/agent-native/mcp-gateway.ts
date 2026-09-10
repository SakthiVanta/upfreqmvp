/**
 * Multi-Provider Model Context Protocol (MCP) Server Gateway
 * Enables Claude Code, Cursor, and external AI agents to natively discover and execute
 * UpFreq Agent-Native Actions via the standard MCP protocol.
 */

import { registry } from './registry';
import { getToolInputJsonSchema } from './mastra-mcp-server';
import { CANONICAL_REGISTRY_ASSETS } from '@/lib/assets/registry';

export interface McpRpcRequest {
  jsonrpc?: string;
  id?: string | number;
  method: string;
  params?: any;
}

export interface McpRpcResponse {
  jsonrpc: string;
  id: string | number | null;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export async function handleMcpRequest(req: McpRpcRequest, userId: string): Promise<McpRpcResponse> {
  const id = req.id ?? null;

  try {
    switch (req.method) {
      case 'initialize':
        return {
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: { listChanged: false },
              resources: { subscribe: false, listChanged: false },
            },
            serverInfo: {
              name: 'upfreq-robotics-mcp',
              version: '3.4.0',
              description: 'UpFreq Robotics Orchestration & Dual Simulation MCP Gateway',
            },
          },
        };

      case 'tools/list': {
        const tools = registry.list().map(action => ({
          name: action.id,
          description: action.description,
          inputSchema: getToolInputJsonSchema(action.id),
        }));

        return {
          jsonrpc: '2.0',
          id,
          result: { tools },
        };
      }

      case 'tools/call': {
        const toolName = req.params?.name;
        const args = req.params?.arguments || {};

        const actionResult = await registry.execute(toolName, args, {
          source: 'mcp',
          userId,
        });

        if (!actionResult.success) {
          return {
            jsonrpc: '2.0',
            id,
            error: {
              code: -32603,
              message: actionResult.error || 'Action execution failed',
            },
          };
        }

        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify(actionResult.data, null, 2),
              },
            ],
            isError: false,
          },
        };
      }

      case 'resources/list': {
        const resources = CANONICAL_REGISTRY_ASSETS.map(asset => ({
          uri: `upfreq://library/${asset.type}s/${asset.assetId}@${asset.version}`,
          name: asset.contract.asset.description || asset.assetId,
          mimeType: 'application/json',
        }));

        return {
          jsonrpc: '2.0',
          id,
          result: { resources },
        };
      }

      case 'resources/read': {
        const uri = req.params?.uri;
        const asset = CANONICAL_REGISTRY_ASSETS.find(
          a => uri === `upfreq://library/${a.type}s/${a.assetId}@${a.version}`
        );

        if (!asset) {
          return {
            jsonrpc: '2.0',
            id,
            error: { code: -32602, message: `Resource not found: ${uri}` },
          };
        }

        return {
          jsonrpc: '2.0',
          id,
          result: {
            contents: [
              {
                uri,
                mimeType: 'application/json',
                text: JSON.stringify(asset.contract, null, 2),
              },
            ],
          },
        };
      }

      default:
        return {
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: `Method not found: ${req.method}` },
        };
    }
  } catch (err: any) {
    return {
      jsonrpc: '2.0',
      id,
      error: { code: -32603, message: err.message || 'Internal error' },
    };
  }
}
