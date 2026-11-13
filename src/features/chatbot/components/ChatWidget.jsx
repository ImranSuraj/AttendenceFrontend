import { useState, useRef, useEffect } from "react";
import { Drawer } from "vaul";
import { MessageCircle, Send, X, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/shared/utils/cn";
import { useChatbotStore } from "../hooks/useChatbot";
import { sendChatMessage, getChatSuggestions } from "../services/chatbot.service";

// Static, frontend-owned suggestions -- CHATBOT_IMPLEMENTATION_PLAN.md §10/§12 deliberately has no
// backend /suggestions endpoint for this (removed per review: suggestions are derived from the
// same static intent definitions already bundled with the app, no round-trip needed). Drawn from
// the real v1 + Phase 4+ capability set, not an exhaustive list of all 29 intents.
const SUGGESTED_QUESTIONS = [
  "Did I punch in today?",
  "What's my leave balance?",
  "Show my leave requests",
  "What are the upcoming holidays?",
  "How do I report a missed punch?",
  "Who approves my leave?",
];

// Three-dot "bot is typing" indicator, reusing the same dot-bounce keyframe DotsLoader.jsx uses --
// not DotsLoader itself, since its own layout (py-10, centered message) is sized for a full
// section, not a compact inline chat bubble.
function TypingDots() {
  return (
    <div className="flex items-center gap-1.5 px-1 py-1">
      {[0, 1, 2].map((i) => (
        <span key={i} className="w-1.5 h-1.5 rounded-full bg-muted-foreground dot-bounce" style={{ animationDelay: `${i * 0.15}s` }}/>
      ))}
    </div>
  );
}

/// <summary>Floating action button + slide-over drawer, per CHATBOT_IMPLEMENTATION_PLAN.md §12 --
/// uses `vaul` (already an installed-but-unused dependency) rather than hand-rolling a new drawer
/// primitive. `onNavigate` is the same setModule function App.jsx already passes to
/// Dashboard/TopNav/EmployeeLeaveBalancePage -- navigation from a chat reply is the identical code
/// path as clicking a Sidebar item, not a separate mechanism.</summary>
export function ChatWidget({ onNavigate, hidden = false, accent }) {
  // Optional accent colour (e.g. the Conference page's Teams blue "#5B5FC7") that replaces the app's
  // primary colour for the chat button and panel only; other pages pass nothing and keep the default.
  const accentVars = accent ? { "--primary": accent, "--primary-foreground": "#ffffff" } : undefined;
  const { isOpen, messages, isSending, open, close, addMessage, setSending, clear } = useChatbotStore();
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const listRef = useRef(null);
  const autoNavigateTimer = useRef(null);

  // Cancel a pending auto-navigate if the user acts again before it fires (e.g. asks something
  // else right after the bot replied) -- don't take them somewhere they no longer asked for.
  useEffect(() => () => clearTimeout(autoNavigateTimer.current), []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isSending]);

  // Live "as you type" suggestions -- debounced (300ms) so we're not firing a request on every
  // keystroke, and only once there's enough text for the embedding matcher to have something real
  // to compare against (chatbot.service.js's own GetSuggestionsAsync also no-ops under 2 chars,
  // this just avoids the wasted round trip).
  useEffect(() => {
    const trimmed = input.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(() => {
      getChatSuggestions(trimmed)
        .then(setSuggestions)
        .catch(() => setSuggestions([])); // best-effort UI hint -- a failure here shouldn't surface as an error toast
    }, 300);
    return () => clearTimeout(timer);
  }, [input]);

  const submit = async (text) => {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;

    clearTimeout(autoNavigateTimer.current);
    addMessage({ role: "user", text: trimmed });
    setInput("");
    setSuggestions([]);
    setSending(true);
    try {
      const response = await sendChatMessage(trimmed);
      addMessage({
        role: "bot",
        text: response.replyText,
        responseType: response.responseType,
        navigationTarget: response.navigationTarget,
        clarificationOptions: response.clarificationOptions,
      });
      scheduleAutoNavigate(response.navigationTarget);
    } catch {
      // Reuse the same sonner convention every other feature uses for a genuine network/error
      // failure -- the bot's own "I didn't understand" replies are normal messages above, never a
      // toast (CHATBOT_IMPLEMENTATION_PLAN.md §12).
      toast.error("Couldn't reach the assistant. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const handleNavigate = (target) => {
    clearTimeout(autoNavigateTimer.current);
    if (target) onNavigate?.(target);
    close();
  };

  // The assistant acts on your behalf instead of just handing you a link to click -- a short pause
  // (so you can actually read the reply first) then it navigates and closes the drawer itself,
  // the way a voice assistant would for an "open X" command. The "Open now →" button on the
  // message is just an accelerator for the impatient, not the only way to get there.
  const scheduleAutoNavigate = (target) => {
    if (!target) return;
    autoNavigateTimer.current = setTimeout(() => handleNavigate(target), 1200);
  };

  // Clicking a live suggestion already tells us the destination -- no need to round-trip through
  // /message again just to have the router re-derive what we already know. Mirrors the same
  // message shape a real /message call would have produced, so it renders identically.
  const pickSuggestion = (suggestion) => {
    clearTimeout(autoNavigateTimer.current);
    const trimmed = input.trim();
    if (trimmed) addMessage({ role: "user", text: trimmed });
    addMessage({
      role: "bot",
      text: `Opening ${suggestion.displayName}.`,
      responseType: "Navigation",
      navigationTarget: suggestion.moduleId,
    });
    setInput("");
    setSuggestions([]);
    scheduleAutoNavigate(suggestion.moduleId);
  };

  if (hidden) return null;

  return (
    <Drawer.Root direction="right" open={isOpen} onOpenChange={(v) => (v ? open() : close())}>
      <Drawer.Trigger asChild>
        <button
          className="fixed bottom-[var(--chat-bottom)] md:bottom-6 right-4 sm:right-6 z-40 w-[52px] h-[52px] md:w-14 md:h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center cursor-pointer hover:bg-primary/90 transition-colors border-0 outline-none focus:outline-none focus-visible:outline-none focus-visible:ring-0"
          style={{ ...accentVars, "--chat-bottom": "1.5rem" }}
          title="Ask the Employee Connect Assistant"
        >
          <MessageCircle size={24}/>
        </button>
      </Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-[color:var(--colorBackgroundOverlay)] z-40"/>
        <Drawer.Content style={accentVars} className="fixed top-0 right-0 bottom-0 z-50 w-full sm:w-[400px] max-w-full bg-card border-l border-border flex flex-col outline-none">
          <div className="flex items-center justify-between py-3 px-4 border-b border-border shrink-0">
            <div className="min-w-0">
              {/* Teams panel-header style: 13px / weight 500 title over a 12px regular secondary line. */}
              <p className="text-[13px] font-[500] leading-5 text-foreground">Employee Connect Assistant</p>
              <p className="text-[12px] font-normal leading-4 text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap">Ask about attendance, leave, holidays &amp; more</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {messages.length > 0 && (
                <button onClick={clear} title="Clear conversation" className="p-1.5 rounded-md bg-transparent border-0 cursor-pointer text-red-600 transition-colors hover:bg-red-50 dark:hover:bg-red-900/20 outline-none focus:outline-none focus-visible:outline-none">
                  <Trash2 size={15}/>
                </button>
              )}
              <button onClick={close} title="Close" className="p-1.5 rounded-md bg-transparent border-0 cursor-pointer hover:bg-muted transition-colors outline-none focus:outline-none focus-visible:outline-none">
                <X size={16} className="text-muted-foreground"/>
              </button>
            </div>
          </div>

          <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 flex flex-col gap-3">
            {messages.length === 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-muted-foreground mb-1">Try asking:</p>
                {SUGGESTED_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => submit(q)}
                    className="text-left text-sm py-2 px-3 rounded-lg border border-border bg-transparent cursor-pointer hover:bg-muted transition-colors text-foreground whitespace-normal [overflow-wrap:anywhere]"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            {messages.map((m) => (
              <div key={m.id} className={cn("flex items-end gap-1.5", m.role === "user" ? "justify-end" : "justify-start")}>
                {m.role === "bot" && (
                  <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                    <MessageCircle size={13}/>
                  </div>
                )}
                <div
                  className={cn(
                    "min-w-0 max-w-[85%] rounded-2xl py-2 px-3.5 text-sm [overflow-wrap:anywhere]",
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : m.responseType === "Error"
                        ? "bg-muted text-foreground border border-destructive/40"
                        : "bg-muted text-foreground"
                  )}
                >
                  <p className="whitespace-pre-wrap">{m.text}</p>

                  {m.role === "bot" && m.navigationTarget && (
                    <button
                      onClick={() => handleNavigate(m.navigationTarget)}
                      className="mt-2 text-xs font-medium py-1.5 px-3 rounded-md bg-primary text-primary-foreground border-0 cursor-pointer hover:bg-primary/90 transition-colors"
                    >
                      Open now →
                    </button>
                  )}

                  {m.role === "bot" && m.clarificationOptions?.length > 0 && (
                    <div className="flex flex-col gap-1.5 mt-2">
                      {m.clarificationOptions.map((opt) => (
                        <button
                          key={opt.moduleId}
                          onClick={() => pickSuggestion(opt)}
                          className="text-left text-xs py-1.5 px-3 rounded-md border border-border bg-card cursor-pointer hover:bg-muted transition-colors text-foreground whitespace-normal [overflow-wrap:anywhere]"
                        >
                          {opt.displayName}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isSending && (
              <div className="flex items-end gap-1.5 justify-start">
                <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                  <MessageCircle size={13}/>
                </div>
                <div className="bg-muted rounded-2xl px-3.5">
                  <TypingDots/>
                </div>
              </div>
            )}
          </div>

          {suggestions.length > 0 && !isSending && (
            <div className="flex flex-wrap gap-1.5 px-3 pt-2 shrink-0">
              {suggestions.map((s) => (
                <button
                  key={s.moduleId}
                  onClick={() => pickSuggestion(s)}
                  className="text-xs py-1 px-2.5 rounded-full border border-border bg-transparent cursor-pointer hover:bg-muted transition-colors text-foreground"
                >
                  {s.displayName}
                </button>
              ))}
            </div>
          )}

          <form
            onSubmit={(e) => { e.preventDefault(); submit(input); }}
            className="flex items-center gap-2 p-3 border-t border-border shrink-0"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask something..."
              className="flex-1 py-2 px-3 text-sm border border-border rounded-lg bg-input-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="submit"
              disabled={isSending || !input.trim()}
              className="w-9 h-9 rounded-lg bg-primary text-primary-foreground border-0 cursor-pointer hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center shrink-0"
            >
              <Send size={16}/>
            </button>
          </form>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
