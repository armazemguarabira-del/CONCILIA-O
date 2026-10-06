import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut as fbSignOut, 
  onAuthStateChanged,
  type User as FirebaseUser
} from 'firebase/auth';
import { 
  getFirestore, 
  initializeFirestore,
  doc, 
  getDocFromServer,
  collection,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  limit
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase App
export const app = initializeApp(firebaseConfig);

const customDatabaseId = (firebaseConfig as any).firestoreDatabaseId && 
  (firebaseConfig as any).firestoreDatabaseId !== '(default)' 
    ? (firebaseConfig as any).firestoreDatabaseId 
    : undefined;

// Configure Firestore with long-polling transport to eliminate iframe/sandbox WebSocket connection failures
try {
  if (customDatabaseId) {
    initializeFirestore(app, {
      experimentalForceLongPolling: true,
    }, customDatabaseId);
  } else {
    initializeFirestore(app, {
      experimentalForceLongPolling: true,
    });
  }
} catch {
  // Safe if already initialized
}

export const db = customDatabaseId ? getFirestore(app, customDatabaseId) : getFirestore(app);

// Initialize Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export { 
  signInWithPopup, 
  fbSignOut, 
  onAuthStateChanged,
  collection,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  limit,
  type FirebaseUser
};

// Mandatory connection test on boot
export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log('[Firebase] Connection to Firestore established successfully.');
    return true;
  } catch (error) {
    if (error instanceof Error && (error.message.includes('the client is offline') || error.message.includes('unavailable') || error.message.includes('could not be completed'))) {
      console.warn('[Firebase] Client is operating in offline/cached mode:', error.message);
    } else {
      console.log('[Firebase] Connection check completed:', error);
    }
    return false;
  }
}

// Immediately trigger test connection on initialization
testConnection();

// Standard Error Handler per Firebase Integration Skill
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
