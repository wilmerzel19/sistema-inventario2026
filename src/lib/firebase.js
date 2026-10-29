import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: "AIzaSyDNgQkJmgLvDeamRS-N7vC5ud_56WYqoFE",
  authDomain: "rastreador-de218.firebaseapp.com",
  databaseURL: "https://rastreador-de218-default-rtdb.firebaseio.com",
  projectId: "rastreador-de218",
  storageBucket: "rastreador-de218.firebasestorage.app",
  messagingSenderId: "374204988768",
  appId: "1:374204988768:web:c4c4a7d17c432a8d05b205"
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
