import { createTool } from '@mastra/core/tools';
import { toStandardSchema, standardSchemaToJSONSchema } from '@mastra/core/schema';
import { registry } from './registry';

/**
 * One Mastra Tool per agent-native action, reusing each action's real Zod
 * schema (`action.schema`) rather than redefining it.
 *
 * This is NOT wired to Mastra's own `MCPServer` HTTP transport. That class
 * (`@mastra/mcp`'s `startHTTP`) is built directly against Node's raw `http`
 * module (`req.headers['x']`, `res.writeHead()`, `res.end()`) — it doesn't
 * fit Next.js App Router's Fetch-based route handlers, which never expose
 * the underlying Node req/res. Forcing that transport in here would mean
 * hand-writing an unverified Node-http compatibility shim purely to satisfy
 * "use Mastra," with real risk of subtle streaming/header bugs.
 *
 * `src/app/api/mcp/route.ts` + `mcp-gateway.ts` still own the actual
 * JSON-RPC wire protocol (OAuth-gated, working since Phase 3) and call
 * `registry.execute()` directly. This module exists so `tools/list` can
 * expose real per-action JSON Schema via Mastra's schema-conversion
 * utilities, replacing the old hand-rolled stub that mapped every field to
 * `{ type: 'string' }` regardless of its actual type.
 */
export const mastraTools = Object.fromEntries(
  registry.list().map(action => [
    action.id,
    createTool({
      id: action.id,
      description: action.description,
      inputSchema: toStandardSchema(action.schema),
    }),
  ])
);

export function getToolInputJsonSchema(actionId: string): Record<string, any> {
  const tool = mastraTools[actionId];
  if (!tool?.inputSchema) return { type: 'object', properties: {} };
  return standardSchemaToJSONSchema(tool.inputSchema, { io: 'input' });
}
