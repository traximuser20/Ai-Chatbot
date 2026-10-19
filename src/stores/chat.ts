import { defineStore } from 'pinia';
import type { ChatMessagePayload } from '../services/omniroute';

export type MessageSender = 'user' | 'ai';

export interface Message {
  text: string;
  sender: MessageSender;
  timestamp: string;
  /** Set when the message carries an error rather than a model reply. */
  isError?: boolean;
}

/**
 * Formats a date as a 12-hour clock time, e.g. "5:19 PM".
 *
 * `Date.prototype.toLocaleTimeString` is NOT used on purpose: the V8 build
 * bundled with Android ignores the `options` argument and the empty-locale
 * array, so it returned the full default string
 * ("17:16:32 GMT+0000 (UTC)") instead of the requested
 * "{ hour: '2-digit', minute: '2-digit' }" format.
 */
export function formatClockTime(date: Date = new Date()): string {
  const hours24 = date.getHours();
  const minutes = date.getMinutes();
  const suffix = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${minutes.toString().padStart(2, '0')} ${suffix}`;
}

export const useChatStore = defineStore('chat', {
  state: () => ({
    messages: [
      {
        text: 'Hello! I am your Omniroute-powered AI. How can I help you today?',
        sender: 'ai' as MessageSender,
        timestamp: formatClockTime(),
      },
    ] as Message[],
    isConnected: false,
    isTyping: false,
    /** Model id sent with each request. */
    model: 'auto/best-fast',
  }),
  getters: {
    hasMessages: (state) => state.messages.length > 0,
  },
  actions: {
    addMessage(text: string, sender: MessageSender, isError = false) {
      this.messages.push({
        text,
        sender,
        timestamp: formatClockTime(),
        isError,
      });
    },
    setConnectionStatus(status: boolean) {
      this.isConnected = status;
    },
    setTypingStatus(status: boolean) {
      this.isTyping = status;
    },
    setModel(model: string) {
      this.model = model;
    },
    clearMessages() {
      this.messages = [];
    },
    /**
     * Builds the request payload for OmniRoute from the visible conversation.
     * The trailing assistant message is dropped because it is the answer the
     * model is about to produce.
     */
    buildHistory(systemPrompt?: string): ChatMessagePayload[] {
      const history: ChatMessagePayload[] = this.messages
        .filter((message) => !message.isError)
        .map((message) => ({
          role: message.sender === 'user' ? ('user' as const) : ('assistant' as const),
          content: message.text,
        }));

      // Drop a trailing assistant reply - it would be duplicated by the
      // answer we are about to request.
      if (history.length && history[history.length - 1].role === 'assistant') {
        history.pop();
      }

      if (systemPrompt) {
        history.unshift({ role: 'system', content: systemPrompt });
      }

      return history;
    },
  },
});
