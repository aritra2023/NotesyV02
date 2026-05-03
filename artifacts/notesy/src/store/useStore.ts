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
  reviewDate: number | null;
  reviewInterval: number;
  isShared?: boolean;
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

  setApiKey: (key: string) => void;
  setColorMode: (mode: 'black' | 'purple' | 'blue' | 'green') => void;
  setFontMode: (mode: 'normal' | 'caveat' | 'patrick' | 'satisfy') => void;
  setAnswerMode: (mode: 'exam' | 'short' | 'explanation' | 'normal') => void;
  setYoutubeMode: (mode: boolean) => void;

  createSubject: (name: string) => void;
  deleteSubject: (id: string) => void;
  updateSubjectName: (id: string, name: string) => void;
  createSession: (subjectId: string, title?: string) => string;
  deleteSession: (id: string) => void;
  setActiveSession: (id: string | null) => void;
  setActiveSubject: (id: string | null) => void;
  updateSessionTitle: (id: string, title: string) => void;
  markForReview: (id: string, days: number) => void;
  clearReview: (id: string) => void;
  markSessionShared: (id: string) => void;
  importSession: (
    subjectName: string,
    sessionId: string,
    sessionTitle: string,
    msgs: Array<{ role: string; content: string }>
  ) => void;

  addMessage: (sessionId: string, role: 'user' | 'model', content: string, id?: string) => string;
  deleteMessageFromId: (sessionId: string, messageId: string) => void;
  addRemoteMessages: (sessionId: string, msgs: Array<{ clientId: string | null; role: string; content: string; createdAt: string }>) => void;

  login: (user: AppUser) => void;
  logout: () => void;
  joinSession: (sessionId: string) => void;
  updateUser: (fields: Partial<Pick<AppUser, 'name' | 'email' | 'passwordHash'>>) => void;
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
        const newSubject: Subject = { id: uuidv4(), name, createdAt: Date.now() };
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
          activeSessionId:
            state.activeSessionId &&
            state.sessions.find((s) => s.id === state.activeSessionId)?.subjectId === id
              ? null
              : state.activeSessionId,
        }));
      },
      updateSubjectName: (id, name) => {
        set((state) => ({ subjects: state.subjects.map((s) => s.id === id ? { ...s, name } : s) }));
      },
      createSession: (subjectId, title = 'New Session') => {
        const currentUser = get().currentUser;
        const participant: Participant = currentUser
          ? { name: currentUser.name, email: currentUser.email, initials: currentUser.name.substring(0, 2).toUpperCase(), color: 'bg-blue-500' }
          : { name: 'You', email: '', initials: 'YO', color: 'bg-primary' };
        const newSession: Session = {
          id: uuidv4(), subjectId, title,
          createdAt: Date.now(),
          participants: [participant],
          reviewDate: null, reviewInterval: 1,
        };
        set((state) => ({ sessions: [...state.sessions, newSession], activeSessionId: newSession.id, activeSubjectId: subjectId }));
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
        set((state) => ({ sessions: state.sessions.map((s) => (s.id === id ? { ...s, title } : s)) }));
      },
      markForReview: (id, days) => {
        const reviewDate = Date.now() + days * 24 * 60 * 60 * 1000;
        set((state) => ({
          sessions: state.sessions.map((s) => s.id === id ? { ...s, reviewDate, reviewInterval: days } : s),
        }));
      },
      clearReview: (id) => {
        set((state) => ({
          sessions: state.sessions.map((s) => s.id === id ? { ...s, reviewDate: null } : s),
        }));
      },
      markSessionShared: (id) => {
        set((state) => ({
          sessions: state.sessions.map((s) => s.id === id ? { ...s, isShared: true } : s),
        }));
      },
      importSession: (subjectName, sessionId, sessionTitle, msgs) => {
        set((state) => {
          const existing = state.sessions.find((s) => s.id === sessionId);
          if (existing) {
            return { activeSessionId: sessionId, activeSubjectId: existing.subjectId };
          }

          let subject = state.subjects.find((s) => s.name === subjectName);
          let newSubjects = state.subjects;
          if (!subject) {
            subject = { id: uuidv4(), name: subjectName, createdAt: Date.now() };
            newSubjects = [...state.subjects, subject];
          }

          const newSession: Session = {
            id: sessionId, subjectId: subject.id, title: sessionTitle,
            createdAt: Date.now(),
            participants: [{ name: 'Invited', email: '', initials: 'IN', color: 'bg-primary' }],
            reviewDate: null, reviewInterval: 1,
            isShared: true,
          };

          const newMessages: Message[] = msgs.map((m, i) => ({
            id: uuidv4(), sessionId,
            role: m.role === 'model' ? 'model' : 'user',
            content: m.content,
            createdAt: Date.now() + i,
          }));

          return {
            subjects: newSubjects,
            sessions: [...state.sessions, newSession],
            messages: [...state.messages, ...newMessages],
            activeSessionId: sessionId,
            activeSubjectId: subject.id,
          };
        });
      },

      addMessage: (sessionId, role, content, id) => {
        const msgId = id ?? uuidv4();
        const newMessage: Message = { id: msgId, sessionId, role, content, createdAt: Date.now() };
        set((state) => ({ messages: [...state.messages, newMessage] }));
        return msgId;
      },
      deleteMessageFromId: (sessionId, messageId) => {
        set((state) => {
          const sessionMessages = state.messages
            .filter((m) => m.sessionId === sessionId)
            .sort((a, b) => a.createdAt - b.createdAt);
          const targetIndex = sessionMessages.findIndex((m) => m.id === messageId);
          if (targetIndex === -1) return state;
          const messagesToDelete = new Set(sessionMessages.slice(targetIndex).map((m) => m.id));
          return { messages: state.messages.filter((m) => !messagesToDelete.has(m.id)) };
        });
      },
      addRemoteMessages: (sessionId, msgs) => {
        set((state) => {
          const existing = state.messages.filter((m) => m.sessionId === sessionId);
          // existingLocalIds: set of local message IDs (used as clientId when posting to sync)
          const existingLocalIds = new Set(existing.map((m) => m.id));

          const toAdd: Message[] = [];
          for (const msg of msgs) {
            // Skip if this remote message's clientId matches one of our own local message IDs
            // (meaning WE sent this message — don't duplicate it)
            if (msg.clientId && existingLocalIds.has(msg.clientId)) continue;
            // Skip if we already imported this exact DB record (by synced DB id stored as clientId in our local msg)
            // This handles re-polls of already-added remote messages
            if (existingLocalIds.has(msg.id)) continue;
            toAdd.push({
              id: msg.id, sessionId,
              role: msg.role === 'model' ? 'model' : 'user',
              content: msg.content,
              createdAt: new Date(msg.createdAt).getTime(),
            });
            existingLocalIds.add(msg.id);
          }

          if (toAdd.length === 0) return state;
          return { messages: [...state.messages, ...toAdd] };
        });
      },

      login: (user) => set({ currentUser: user }),
      logout: () => set({ currentUser: null }),
      updateUser: (fields) =>
        set((state) =>
          state.currentUser ? { currentUser: { ...state.currentUser, ...fields } } : state
        ),
      joinSession: (sessionId) => {
        set((state) => {
          if (!state.currentUser) return state;
          const user = state.currentUser;
          if (user.joinedSessions.includes(sessionId)) return state;
          return { currentUser: { ...user, joinedSessions: [...user.joinedSessions, sessionId] } };
        });
      },
    }),
    { name: 'notesy-storage' }
  )
);
