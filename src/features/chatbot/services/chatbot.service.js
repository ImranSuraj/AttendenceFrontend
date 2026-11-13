import * as controller from "../controllers/chatbot.controller";

// Real backend call (POST /api/chatbot/message) -- through the same shared axios instance every
// other feature uses, so identity headers (X-Employee-No/X-Role) are attached automatically, no
// special auth wiring needed here (CHATBOT_IMPLEMENTATION_PLAN.md §12).
//
// No custom timeout override (uses the shared instance's 15s default) -- the backend's chatbot
// route is embedding-based cosine-similarity matching (SemanticModuleRouter), consistently
// 1-10ms/query. An earlier local-LLM router needed a 60s override (12-20s/query); that approach
// was replaced entirely, so the override is gone too.
export async function sendChatMessage(message) {
  const data = await controller.sendMessage({ message });
  return data; // ChatbotResponse: { replyText, responseType, navigationTarget, clarificationOptions, data }
}

// Live "as you type" suggestions -- called on every keystroke (debounced client-side in
// ChatWidget.jsx), cheap enough given the backend's own measured 1-10ms/query.
export async function getChatSuggestions(partialMessage) {
  const data = await controller.suggestions({ message: partialMessage });
  return data; // ChatSuggestion[]: [{ moduleId, displayName }]
}
