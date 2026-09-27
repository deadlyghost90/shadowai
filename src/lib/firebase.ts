/**
 * Firebase — auth and realtime database.
 *
 * Initialised once, lazily, and only when the config is present. Everything
 * else in the app talks to the typed helpers in `./cloud.ts`, never to Firebase
 * directly, so swapping backends stays a one-file change.
 */

import { initializeApp, type FirebaseApp } from 'firebase/app'
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  type Auth,
  type User,
} from 'firebase/auth'
import {
  getDatabase,
  ref,
  onValue,
  set,
  update,
  remove,
  get,
  off,
  type Database,
} from 'firebase/database'

/**
 * Web config. Firebase web keys are identifiers, not secrets — the real
 * protection is Realtime Database rules, which ship in
 * `database.rules.json`. Anyone can read this; nobody can read your data
 * without passing those rules.
 */
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyA6wPHL_djIKbSZiljyFIXVw-Y3-sml0qw',
  authDomain: 'shadowai-by-shadowmotion.firebaseapp.com',
  databaseURL: 'https://shadowai-by-shadowmotion-default-rtdb.firebaseio.com',
  projectId: 'shadowai-by-shadowmotion',
  storageBucket: 'shadowai-by-shadowmotion.firebasestorage.app',
  messagingSenderId: '547676146583',
  appId: '1:547676146583:web:ff772d7f82449fbada52d2',
}

let app: FirebaseApp | null = null
let _auth: Auth | null = null
let _db: Database | null = null

export function firebaseEnabled(): boolean {
  return Boolean(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.databaseURL)
}

export function getFirebaseApp(): FirebaseApp {
  if (!app) app = initializeApp(FIREBASE_CONFIG)
  return app
}

export function getFirebaseAuth(): Auth {
  if (!_auth) {
    _auth = getAuth(getFirebaseApp())
    // stay signed in across tabs and reloads
    setPersistence(_auth, browserLocalPersistence).catch(() => undefined)
  }
  return _auth
}

export function getFirebaseDB(): Database {
  if (!_db) _db = getDatabase(getFirebaseApp())
  return _db
}

export const googleProvider = () => {
  const p = new GoogleAuthProvider()
  p.setCustomParameters({ prompt: 'select_account' })
  return p
}

/* ------------------------------------------------------------------ auth */

export async function signInWithGoogle(): Promise<User> {
  const cred = await signInWithPopup(getFirebaseAuth(), googleProvider())
  return cred.user
}

export async function signInWithEmail(email: string, password: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(getFirebaseAuth(), email, password)
  return cred.user
}

export async function signUpWithEmail(
  email: string,
  password: string,
  displayName: string,
): Promise<User> {
  const cred = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password)
  if (displayName.trim()) await updateProfile(cred.user, { displayName: displayName.trim() })
  return cred.user
}

export async function sendReset(email: string): Promise<void> {
  await sendPasswordResetEmail(getFirebaseAuth(), email)
}

export function signOut(): Promise<void> {
  return fbSignOut(getFirebaseAuth())
}

export function watchAuth(cb: (user: User | null) => void): () => void {
  return onAuthStateChanged(getFirebaseAuth(), cb)
}

/**
 * Firebase auth errors are coded and safe to show, but the raw codes are not
 * friendly. This maps them to language a person can act on.
 */
export function authErrorMessage(e: unknown): string {
  const code = (e as { code?: string })?.code || ''
  switch (code) {
    case 'auth/invalid-email':
      return 'That email address does not look right.'
    case 'auth/missing-password':
      return 'Enter your password.'
    case 'auth/weak-password':
      return 'Passwords need at least 6 characters.'
    case 'auth/email-already-in-use':
      return 'An account with that email already exists. Try signing in.'
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'That email and password do not match.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a minute and try again.'
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Google sign-in was cancelled.'
    case 'auth/popup-blocked':
      return 'Your browser blocked the Google popup. Allow popups and retry.'
    case 'auth/network-request-failed':
      return 'Network problem reaching Firebase. Check your connection.'
    case 'auth/operation-not-allowed':
      return 'That sign-in method is not enabled in the Firebase console.'
    default:
      return 'Something went wrong signing in. Try again.'
  }
}

/* -------------------------------------------------------------- database */

export { ref, onValue, set, update, remove, get, off }
