import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

export type Subject = {
  id: string;
  name: string;
  createdAt: number;
};

export type Participant = {
  name: string;
  email: string;
  initials: string;
  color: string;
};

export type Session = {
  id: string;
  subjectId: string;
  title: string;
  createdAt: number;
  participants: Participant[];
};

export type Message = {
  id: string;
  sessionId: string;
  role: 'user' | 'model';
  content: string;
  createdAt: number;
};

export type AppUser = {
  name: string;
  email: string;
  passwordHash: string;
  joinedSessions: string[];
};

type AppState = {
  subjects: Subject[];
  sessions: Session[];
  messages: Message[];
  activeSessionId: string | null;
  activeSubjectId: string | null;
  colorMode: 'black' | 'purple' | 'blue' | 'green';
  fontMode: 'normal' | 'caveat' | 'patrick' | 'satisfy';
  apiKey: string;
  answerMode: 'exam' | 'short' | 'explanation' | 'normal';
  youtubeMode: boolean;
  currentUser: AppUser | null;
  
  // Actions
  setApiKey: (key: string) => void;
  setColorMode: (mode: 'black' | 'purple' | 'blue' | 'green') => void;
  setFontMode: (mode: 'normal' | 'caveat' | 'patrick' | 'satisfy') => void;
  setAnswerMode: (mode: 'exam' | 'short' | 'explanation' | 'normal') => void;
  setYoutubeMode: (mode: boolean) => void;
  
  createSubject: (name: string) => void;
  deleteSubject: (id: string) => void;
  createSession: (subjectId: string, title?: string) => string;
  deleteSession: (id: string) => void;
  setActiveSession: (id: string | null) => void;
  setActiveSubject: (id: string | null) => void;
  updateSessionTitle: (id: string, title: string) => void;
  
  addMessage: (sessionId: string, role: 'user' | 'model', content: string) => void;
  deleteMessageFromId: (sessionId: string, messageId: string) => void;
  
  login: (user: AppUser) => void;
  logout: () => void;
  joinSession: (sessionId: string) => void;
};

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      subjects: [],
      sessions: [],
      messages: [],
      activeSessionId: null,
      activeSubjectId: null,
      colorMode: 'black',
      fontMode: 'normal',
      apiKey: '',
      answerMode: 'normal',
      youtubeMode: false,
      currentUser: null,

      setApiKey: (key) => set({ apiKey: key }),
      setColorMode: (mode) => set({ colorMode: mode }),
      setFontMode: (mode) => set({ fontMode: mode }),
      setAnswerMode: (mode) => set({ answerMode: mode }),
      setYoutubeMode: (mode) => set({ youtubeMode: mode }),

      createSubject: (name) => {
        const newSubject: Subject = {
          id: uuidv4(),
          name,
          createdAt: Date.now(),
        };
        set((state) => ({ subjects: [...state.subjects, newSubject] }));
      },
      deleteSubject: (id) => {
        set((state) => ({
          subjects: state.subjects.filter((s) => s.id !== id),
          sessions: state.sessions.filter((s) => s.subjectId !== id),
          messages: state.messages.filter(
            (m) => !state.sessions.find((s) => s.subjectId === id && s.id === m.sessionId)
          ),
          activeSubjectId: state.activeSubjectId === id ? null : state.activeSubjectId,
          activeSessionId: state.activeSessionId && state.sessions.find((s) => s.id === state.activeSessionId)?.subjectId === id ? null : state.activeSessionId,
        }));
      },
      createSession: (subjectId, title = 'New Session') => {
        const currentUser = get().currentUser;
        const participant: Participant = currentUser ? {
          name: currentUser.name,
          email: currentUser.email,
          initials: currentUser.name.substring(0, 2).toUpperCase(),
          color: 'bg-blue-500',
        } : { name: 'You', email: '', initials: 'YO', color: 'bg-primary' };

        const newSession: Session = {
          id: uuidv4(),
          subjectId,
          title,
          createdAt: Date.now(),
          participants: [participant],
        };
        set((state) => ({
          sessions: [...state.sessions, newSession],
          activeSessionId: newSession.id,
          activeSubjectId: subjectId,
        }));
        return newSession.id;
      },
      deleteSession: (id) => {
        set((state) => ({
          sessions: state.sessions.filter((s) => s.id !== id),
          messages: state.messages.filter((m) => m.sessionId !== id),
          activeSessionId: state.activeSessionId === id ? null : state.activeSessionId,
        }));
      },
      setActiveSession: (id) => set({ activeSessionId: id }),
      setActiveSubject: (id) => set({ activeSubjectId: id }),
      updateSessionTitle: (id, title) => {
        set((state) => ({
          sessions: state.sessions.map((s) => (s.id === id ? { ...s, title } : s)),
        }));
      },

      addMessage: (sessionId, role, content) => {
        const newMessage: Message = {
          id: uuidv4(),
          sessionId,
          role,
          content,
          createdAt: Date.now(),
        };
        set((state) => ({ messages: [...state.messages, newMessage] }));
      },
      deleteMessageFromId: (sessionId, messageId) => {
        set((state) => {
          const sessionMessages = state.messages.filter(m => m.sessionId === sessionId).sort((a, b) => a.createdAt - b.createdAt);
          const targetIndex = sessionMessages.findIndex(m => m.id === messageId);
          if (targetIndex === -1) return state;
          
          const messagesToDelete = new Set(sessionMessages.slice(targetIndex).map(m => m.id));
          return {
            messages: state.messages.filter(m => !messagesToDelete.has(m.id))
          };
        });
      },
      
      login: (user) => set({ currentUser: user }),
      logout: () => set({ currentUser: null }),
      joinSession: (sessionId) => {
        set((state) => {
          if (!state.currentUser) return state;
          const user = state.currentUser;
          if (user.joinedSessions.includes(sessionId)) return state;
          
          return {
            currentUser: { ...user, joinedSessions: [...user.joinedSessions, sessionId] }
          };
        });
      }
    }),
    {
      name: 'notesy-storage',
    }
  )
);
