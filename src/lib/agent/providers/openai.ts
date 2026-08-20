import { AgentProvider } from '../types';
import { runOpenAICompatibleAgent } from './openai-compatible';

export const runOpenAIAgent: AgentProvider = (ctx) =>
  runOpenAICompatibleAgent(
    {
      baseUrl: 'https://api.openai.com/v1',
      apiKey: ctx.apiKey,
      providerLabel: 'OpenAI',
      // OpenAI's current reasoning-capable models (GPT-5.x) expect
      // max_completion_tokens on Chat Completions — plain max_tokens is
      // deprecated for them.
      maxTokensParam: 'max_completion_tokens',
    },
    ctx
  );
