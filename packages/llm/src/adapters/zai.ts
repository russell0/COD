/**
 * Z.ai adapter for GLM-5/5.1 and other Zhipu AI models.
 * Uses the OpenAI-compatible API at https://api.z.ai/api/paas/v4/
 *
 * GLM-5.1 (latest):
 *   - 744B total / 40-44B active (MoE: 256 experts, 8 active)
 *   - 200K context input, 131K max output
 *   - Trained on 28.5T tokens on 100K Huawei Ascend 910B chips
 *   - 77.8% SWE-bench Verified, 86.0% GPQA Diamond
 *   - API pricing: $1.00/M input, $3.20/M output
 *   - MIT license, open weights (expected April 2026)
 *
 * Supports tool/function calling natively.
 * Requires a Z.ai API key: https://docs.z.ai
 */
import { OpenAIAdapter } from './openai.js';
import type { LLMAdapter, LLMRequestOptions, LLMStreamEvent, Message } from '@cod/types';

export class ZaiAdapter implements LLMAdapter {
  readonly providerId = 'zai';
  private inner: OpenAIAdapter;

  constructor(apiKey: string, baseUrl = 'https://api.z.ai/api/paas/v4/') {
    this.inner = new OpenAIAdapter(apiKey, baseUrl);
  }

  stream(options: LLMRequestOptions): AsyncIterable<LLMStreamEvent> {
    return this.inner.stream(options);
  }

  countTokens(messages: Message[]): Promise<number> {
    return this.inner.countTokens(messages);
  }
}
