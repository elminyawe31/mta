import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Model {
  name: string;
  displayName: string;
  available: boolean;
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  apiContent?: any;
}

export interface GeminiKey {
  key: string;
  name: string;
  usageCount: number;
  date: string;
  limit: number;
}

export interface ChatSession {
  id: string;
  topic: string;
  messages: Message[];
}

interface AppState {
  models: Model[];
  autoSync: boolean;
  selectedModel: string | null;
  selectedVisionModel: string | null;
  defaultVisionModel: string;
  sessions: ChatSession[];
  currentSessionId: string | null;
  theme: 'dark' | 'light';
  isSidebarOpen: boolean;
  isAdminVisible: boolean;
  geminiApiKey: string;
  geminiApiKeys: GeminiKey[];
  openRouterApiKey: string;
  modelLimits: Record<string, number | null>;
  modelUsage: Record<string, { date: string, count: number }>;
  setTheme: (theme: 'dark' | 'light') => void;
  setAutoSync: (val: boolean) => void;
  setModels: (models: Model[]) => void;
  setSelectedModel: (model: string) => void;
  setSelectedVisionModel: (model: string) => void;
  setDefaultVisionModel: (model: string) => void;
  setGeminiApiKey: (key: string) => void;
  addGeminiApiKey: (apiKey: GeminiKey) => void;
  removeGeminiApiKey: (key: string) => void;
  updateGeminiApiKeyUsage: (key: string) => void;
  setOpenRouterApiKey: (key: string) => void;
  setModelLimit: (model: string, limit: number | null) => void;
  incrementModelUsage: (model: string) => void;
  setSidebarOpen: (isOpen: boolean) => void;
  setAdminVisible: (isVisible: boolean) => void;
  addSession: () => void;
  setCurrentSession: (id: string) => void;
  addMessage: (sessionId: string, message: Message) => void;
  updateLastMessage: (sessionId: string, content: string) => void;
  deleteSession: (id: string) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      models: [],
      autoSync: true,
      selectedModel: null,
      selectedVisionModel: null,
      defaultVisionModel: 'google/gemini-2.5-flash',
      sessions: [{ id: 'default', topic: 'New Chat', messages: [] }],
      currentSessionId: 'default',
      theme: 'dark',
      isSidebarOpen: true,
      isAdminVisible: false,
      geminiApiKey: '',
      geminiApiKeys: [],
      openRouterApiKey: '',
      modelLimits: {},
      modelUsage: {},

      setTheme: (theme) => set({ theme }),
      setAutoSync: (val) => set({ autoSync: val }),
      setSidebarOpen: (val) => set({ isSidebarOpen: val }),
      setAdminVisible: (val) => set({ isAdminVisible: val }),
      setGeminiApiKey: (key) => set({ geminiApiKey: key }),
      addGeminiApiKey: (apiKey) => set((state) => ({ geminiApiKeys: [...state.geminiApiKeys, apiKey] })),
      removeGeminiApiKey: (key) => set((state) => ({ geminiApiKeys: state.geminiApiKeys.filter(k => k.key !== key) })),
      updateGeminiApiKeyUsage: (keyToUpdate) => set((state) => {
        const today = new Date().toISOString().split('T')[0];
        return {
          geminiApiKeys: state.geminiApiKeys.map(k => {
            if (k.key === keyToUpdate) {
              return { ...k, usageCount: k.date === today ? k.usageCount + 1 : 1, date: today };
            }
            return k; // If different key, keep it, but wait, should we reset others if their date is old? We do that lazily when they are accessed.
          }).map(k => k.date !== today ? { ...k, usageCount: 0, date: today } : k)
        };
      }),
      setOpenRouterApiKey: (key) => set({ openRouterApiKey: key }),
      
      setModelLimit: (model, limit) => set((state) => ({
        modelLimits: { ...state.modelLimits, [model]: limit }
      })),
      
      incrementModelUsage: (model) => set((state) => {
        const today = new Date().toISOString().split('T')[0];
        const usage = state.modelUsage[model] || { date: today, count: 0 };
        const newCount = usage.date === today ? usage.count + 1 : 1;
        
        return {
          modelUsage: {
             ...state.modelUsage,
             [model]: { date: today, count: newCount }
          }
        };
      }),
      
      setModels: (models) => set((state) => {
        // If selected model is not in the new list, clear or pick first
        let newSelected = state.selectedModel;
        if (models.length > 0) {
          if (!newSelected || !models.find(m => m.name === newSelected)) {
            newSelected = models[0].name;
          }
        } else {
          newSelected = null;
        }
        return { models, selectedModel: newSelected };
      }),
      
      setSelectedModel: (model) => set({ selectedModel: model }),
      setSelectedVisionModel: (model) => set({ selectedVisionModel: model }),
      setDefaultVisionModel: (model) => set({ defaultVisionModel: model }),
      
      addSession: () => set((state) => {
        const newSession: ChatSession = {
          id: Date.now().toString(),
          topic: 'New Chat',
          messages: []
        };
        return {
          sessions: [newSession, ...state.sessions],
          currentSessionId: newSession.id
        };
      }),

      setCurrentSession: (id) => set({ currentSessionId: id }),

      deleteSession: (id) => set((state) => {
        const newSessions = state.sessions.filter(s => s.id !== id);
        if (newSessions.length === 0) {
          newSessions.push({ id: Date.now().toString(), topic: 'New Chat', messages: [] });
        }
        return {
          sessions: newSessions,
          currentSessionId: state.currentSessionId === id ? newSessions[0].id : state.currentSessionId
        };
      }),

      addMessage: (sessionId, message) => set((state) => ({
        sessions: state.sessions.map(s => {
          if (s.id === sessionId) {
            // Update topic if it's the first user message
            const topic = s.messages.length === 0 && message.role === 'user' 
              ? message.content.slice(0, 30) + '...'
              : s.topic;
            return { ...s, topic, messages: [...s.messages, message] };
          }
          return s;
        })
      })),

      updateLastMessage: (sessionId, content) => set((state) => ({
        sessions: state.sessions.map(s => {
          if (s.id === sessionId) {
            const newMessages = [...s.messages];
            if (newMessages.length > 0) {
              newMessages[newMessages.length - 1].content = content;
            }
            return { ...s, messages: newMessages };
          }
          return s;
        })
      }))
    }),
    {
      name: 'elminyawe-chat-storage',
    }
  )
);
