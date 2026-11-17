import { getApp, getApps, initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'

function required(value: string | undefined, name: string) {
  if (!value) {
    throw new Error(`Thiếu biến môi trường ${name}.`)
  }

  return value
}

const firebaseConfig = {
  apiKey: required(import.meta.env.VITE_FIREBASE_API_KEY, 'VITE_FIREBASE_API_KEY'),
  authDomain: required(
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    'VITE_FIREBASE_AUTH_DOMAIN',
  ),
  projectId: required(
    import.meta.env.VITE_FIREBASE_PROJECT_ID,
    'VITE_FIREBASE_PROJECT_ID',
  ),
  storageBucket: required(
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    'VITE_FIREBASE_STORAGE_BUCKET',
  ),
  messagingSenderId: required(
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
  ),
  appId: required(import.meta.env.VITE_FIREBASE_APP_ID, 'VITE_FIREBASE_APP_ID'),
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
}

const firebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig)

export const auth = getAuth(firebaseApp)
