import { AgentProvider } from '../types';
import { runOpenAICompatibleAgent } from './openai-compatible';

export const runOpenAIAgent: AgentProvider = (ctx) =>
  runOpenAICompatibleAgent(
    { baseUrl: 'https://api.openai.com/v1', apiKey: ctx.apiKey, providerLabel: 'OpenAI' },
    ctx
  );
