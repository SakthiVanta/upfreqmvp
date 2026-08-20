import { AgentProvider } from '../types';
import { runOpenAICompatibleAgent } from './openai-compatible';

// OpenRouter's /chat/completions endpoint is OpenAI-compatible, so this is
// just a config wrapper — see openai-compatible.ts for the actual loop.
// HTTP-Referer/X-Title are attribution headers OpenRouter recommends
// (not required, but identify the app in their dashboard).
export const runOpenRouterAgent: AgentProvider = (ctx) =>
  runOpenAICompatibleAgent(
    {
      baseUrl: 'https://openrouter.ai/api/v1',
      apiKey: ctx.apiKey,
      providerLabel: 'OpenRouter',
      extraHeaders: {
        'HTTP-Referer': 'https://upfreq.app',
        'X-Title': 'UpFreq',
      },
    },
    ctx
  );
