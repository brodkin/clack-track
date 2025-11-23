# AI Provider Usage Guide

This guide explains how to use the AI provider infrastructure in Clack Track.

## AIProvider Interface

All AI providers implement the `AIProvider` interface:

```typescript
interface AIProvider {
  generate(request: AIGenerationRequest): Promise<AIGenerationResponse>;
  validateConnection(): Promise<boolean>;
}
```

## Using the Factory Pattern

The recommended way to create AI provider instances is through the factory function:

```typescript
import { createAIProvider } from '@/api/ai/index.js';

// Create provider based on AI_PROVIDER environment variable
const provider = createAIProvider();

// Generate content
const response = await provider.generate({
  prompt: 'Write a motivational quote for a Vestaboard display',
  maxTokens: 100,
});

console.log(response.text); // Generated text
console.log(response.model); // Model used (e.g., "gpt-4-turbo-preview")
console.log(response.usage); // Token usage statistics
```

## Direct OpenAI Usage

```typescript
import { OpenAIClient } from '@/api/ai/openai.js';

const client = new OpenAIClient(process.env.OPENAI_API_KEY!);

// Test connection
const isConnected = await client.validateConnection();
if (!isConnected) {
  throw new Error('Failed to connect to OpenAI');
}

// Generate content
const response = await client.generate({
  prompt: 'Hello, world!',
  model: 'gpt-4-turbo-preview', // Optional: override default
  maxTokens: 150, // Optional: limit response length
});
```

## Direct Anthropic Usage

```typescript
import { AnthropicClient } from '@/api/ai/anthropic.js';

const client = new AnthropicClient(process.env.ANTHROPIC_API_KEY!);

// Test connection
const isConnected = await client.validateConnection();
if (!isConnected) {
  throw new Error('Failed to connect to Anthropic');
}

// Generate content
const response = await client.generate({
  prompt: 'Hello, Claude!',
  model: 'claude-3-5-sonnet-20241022', // Optional: override default
  maxTokens: 150,
});
```

## Error Handling

All providers throw typed errors for better error handling:

```typescript
import { createAIProvider } from '@/api/ai/index.js';
import { RateLimitError, AuthenticationError, InvalidRequestError } from '@/types/errors.js';

const provider = createAIProvider();

try {
  const response = await provider.generate({ prompt: 'Test' });
} catch (error) {
  if (error instanceof RateLimitError) {
    console.error('Rate limit exceeded - wait 60 seconds');
    // Implement retry logic
  } else if (error instanceof AuthenticationError) {
    console.error('Invalid API key - check your configuration');
  } else if (error instanceof InvalidRequestError) {
    console.error('Invalid request parameters');
  }
  throw error;
}
```

## Testing Best Practices

When writing tests for code that uses AI providers, use the mock factories:

```typescript
import {
  createMockOpenAIClient,
  createMockAnthropicClient,
} from '@tests/__mocks__/ai-providers.js';

// Mock successful generation
const mockProvider = createMockOpenAIClient({
  responseText: 'Mock AI response',
  model: 'gpt-4-turbo-preview',
});

// Mock failure scenarios
const failingProvider = createMockOpenAIClient({
  shouldFail: true,
  failureMessage: 'Rate limit exceeded',
});

// Mock connection validation
const disconnectedProvider = createMockOpenAIClient({
  connectionValid: false,
});
```

See `tests/__mocks__/ai-providers.ts` for full mock API.

## CLI Testing

Use the `test-ai` command to verify provider connectivity:

```bash
# Test all configured providers
npm run test:ai

# Test specific provider
npm run test:ai:openai
npm run test:ai:anthropic

# Interactive mode (future feature)
npm run test:ai -- --interactive
```

## Configuration Reference

| Environment Variable | Description                               | Default                             |
| -------------------- | ----------------------------------------- | ----------------------------------- |
| `AI_PROVIDER`        | Provider to use (`openai` or `anthropic`) | `openai`                            |
| `OPENAI_API_KEY`     | OpenAI API key                            | (required if AI_PROVIDER=openai)    |
| `OPENAI_MODEL`       | OpenAI model name                         | `gpt-4-turbo-preview`               |
| `ANTHROPIC_API_KEY`  | Anthropic API key                         | (required if AI_PROVIDER=anthropic) |
| `ANTHROPIC_MODEL`    | Anthropic model name                      | `claude-3-5-sonnet-20241022`        |

## Troubleshooting

**Problem:** `AIProviderError: No API key found for provider: openai`
**Solution:** Set `OPENAI_API_KEY` in your `.env` file

**Problem:** `RateLimitError: Rate limit exceeded`
**Solution:** Wait 60 seconds between requests or upgrade your API tier

**Problem:** `AuthenticationError: Invalid API key`
**Solution:** Verify your API key is correct and active in your provider dashboard

**Problem:** Tests making real API calls
**Solution:** Ensure you're using mock providers from `tests/__mocks__/ai-providers.ts`
