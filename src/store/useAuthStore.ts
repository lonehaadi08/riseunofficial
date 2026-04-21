import { create } from 'zustand';
import { onAuthStateChanged, signOut } from 'firebase/auth'; // <-- Imported signOut here!
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';

export interface User {
  id: string;
  name: string;
  role: string;
  batch?: string;
  phone?: string;
  profilePic?: string;
  about?: string;
  studentClass?: string;
  aim?: string; // <-- Added aim here!
}

interface AuthState {
  user: User | null;
  isInitialized: boolean;
  login: (userData: User) => void;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
  checkSession: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isInitialized: false,
  
  login: (userData) => set({ user: userData }),
  
  // Fixed Firebase v9 logout syntax
  logout: async () => {
    await signOut(auth); 
    set({ user: null });
  },

  updateUser: (updates) => set((state) => ({
    user: state.user ? { ...state.user, ...updates } : null
  })),

  checkSession: () => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            set({ user: { id: firebaseUser.uid, ...userDoc.data() } as User, isInitialized: true });
          } else {
            set({ user: null, isInitialized: true });
          }
        } catch (error) {
          set({ user: null, isInitialized: true });
        }
      } else {
        set({ user: null, isInitialized: true });
      }
    });
    return unsubscribe;
  }
}));