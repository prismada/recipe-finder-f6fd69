import { query, type Options, type McpServerConfig } from "@anthropic-ai/claude-agent-sdk";

export const MCP_CONFIG: McpServerConfig = {
  type: "stdio",
  command: "npx",
  args: ["-y", "@anthropic-ai/mcp-server-puppeteer"],
};

export const ALLOWED_TOOLS = [
  "mcp__mcp__puppeteer_navigate",
  "mcp__mcp__puppeteer_screenshot",
  "mcp__mcp__puppeteer_click",
  "mcp__mcp__puppeteer_fill",
  "mcp__mcp__puppeteer_evaluate"
];

export const SYSTEM_PROMPT = `You are a recipe finder assistant. You help users discover recipes from AllRecipes by searching for specific dishes, ingredients, or cuisine types. When a user asks for a recipe, you:

1. Search AllRecipes using the mcp__mcp__puppeteer tools to navigate and extract recipe information
2. Present recipe details including ingredients, instructions, prep time, and cook time
3. Can search for recipes based on ingredients, dish names, cuisine types, or dietary restrictions
4. Provide helpful cooking tips and suggestions

Be friendly, helpful, and enthusiastic about cooking. Always format recipe information clearly with proper sections for ingredients and instructions.`;

export function getOptions(standalone = false): Options {
  return {
    systemPrompt: SYSTEM_PROMPT,
    model: "haiku",
    allowedTools: ALLOWED_TOOLS,
    maxTurns: 50,
    ...(standalone && { mcpServers: { mcp: MCP_CONFIG } }),
  };
}

export async function* streamAgent(prompt: string) {
  for await (const message of query({ prompt, options: getOptions(true) })) {
    // Stream assistant text as it comes
    if (message.type === "assistant" && (message as any).message?.content) {
      for (const block of (message as any).message.content) {
        if (block.type === "text" && block.text) {
          yield { type: "text", text: block.text };
        }
      }
    }

    // Stream tool use info
    if (message.type === "assistant" && (message as any).message?.content) {
      for (const block of (message as any).message.content) {
        if (block.type === "tool_use") {
          yield { type: "tool", name: block.name };
        }
      }
    }

    // Usage stats
    if ((message as any).message?.usage) {
      const u = (message as any).message.usage;
      yield { type: "usage", input: u.input_tokens || 0, output: u.output_tokens || 0 };
    }

    // Final result
    if ("result" in message && message.result) {
      yield { type: "result", text: message.result };
    }
  }

  yield { type: "done" };
}
