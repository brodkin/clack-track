# Prompts Directory

This directory contains AI prompt templates used for generating Vestaboard content.

## Structure

- **system/** - System prompts that define the AI's role and constraints
- **user/** - User prompts that specify what type of content to generate

## System Prompts

System prompts define:

- The AI's role (content generator for Vestaboard)
- Technical constraints (6 rows, 22 chars/row, character set)
- General guidelines for content creation

### Available System Prompts

- `major-update-base.txt` - Base system prompt for major content updates
- `minor-update-base.txt` - System prompt for time/weather-only updates

## User Prompts

User prompts specify the type of content to generate:

- What information to include
- The tone and style
- Specific requirements for that content type

### Available User Prompts

- `haiku.txt` - Traditional Japanese poetry
- `news-summary.txt` - News headlines from RSS feeds
- `weather-focus.txt` - Weather-centric display

## Usage

Prompts are loaded by the `PromptLoader` class in `src/content/prompt-loader.ts`:

```typescript
const loader = new PromptLoader('./prompts');
const template = await loader.loadPromptTemplate('major-update-base.txt', 'haiku.txt');
```

## Creating New Prompts

1. Add new system prompts to `system/` directory
2. Add new user prompts to `user/` directory
3. Use descriptive filenames (e.g., `birthday-greeting.txt`)
4. Include clear instructions about what content to generate
5. Specify any data sources or context needed

## Best Practices

- Keep prompts focused and specific
- Include examples when helpful
- Specify the desired output format
- Consider Vestaboard's display limitations
- Test prompts with different data inputs
