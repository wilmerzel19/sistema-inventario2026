import { createContext, useContext, useEffect, useState } from 'react'
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  linkWithPopup,
  reauthenticateWithPopup,
} from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'
import { slugify } from '../utils/format'

const AuthContext = createContext(null)
const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: 'select_account' })

const googlePhotosProvider = new GoogleAuthProvider()
googlePhotosProvider.addScope('https://www.googleapis.com/auth/photoslibrary.appendonly')
googlePhotosProvider.setCustomParameters({ prompt: 'consent' })

function defaultStore(firebaseUser, storeName = '') {
  const safeName = (storeName || 'Mi Tienda').trim() || 'Mi Tienda'
  return {
    ownerUid: firebaseUser.uid,
    name: safeName,
    legalName: '',
    slogan: '',
    email: firebaseUser.email || '',
    taxId: '',
    slug: `${slugify(safeName)}-${firebaseUser.uid.slice(0, 6).toLowerCase()}`,
    logoUrl: '',
    phone: '',
    whatsapp: '',
    address: '',
    currency: 'USD',
    taxLabel: 'IVA',
    taxRate: 0,
    accentColor: '#6366f1',
    catalogPublic: true,
    schemaVersion: 9,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [store, setStore] = useState(null)
  const [loading, setLoading] = useState(true)

  async function loadStore(uid) {
    const ref = doc(db, 'stores', uid)
    const snap = await getDoc(ref)
    if (snap.exists()) {
      const value = { id: snap.id, ...snap.data() }
      setStore(value)
      return value
    }
    setStore(null)
    return null
  }

  async function ensureAccountSpace(firebaseUser, preferredStoreName = '') {
    if (!firebaseUser) return null

    const storeRef = doc(db, 'stores', firebaseUser.uid)
    const userRef = doc(db, 'users', firebaseUser.uid)
    const existingStore = await getDoc(storeRef)

    if (!existingStore.exists()) {
      await setDoc(storeRef, defaultStore(firebaseUser, preferredStoreName))
    }

    await setDoc(userRef, {
      uid: firebaseUser.uid,
      email: firebaseUser.email || '',
      displayName: firebaseUser.displayName || '',
      photoURL: firebaseUser.photoURL || '',
      providers: firebaseUser.providerData.map(item => item.providerId),
      lastLoginAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      ...(existingStore.exists() ? {} : { createdAt: serverTimestamp() }),
    }, { merge: true })

    return loadStore(firebaseUser.uid)
  }

  useEffect(() => onAuthStateChanged(auth, async (current) => {
    try {
      setUser(current)
      if (current) await ensureAccountSpace(current)
      else setStore(null)
    } catch (error) {
      console.error('No se pudo preparar el espacio del usuario:', error)
      setStore(null)
    } finally {
      setLoading(false)
    }
  }), [])

  async function login(email, password) {
    const cred = await signInWithEmailAndPassword(auth, email, password)
    await ensureAccountSpace(cred.user)
    return cred.user
  }

  async function register(email, password, storeName) {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    const cleanStoreName = (storeName || 'Mi Tienda').trim() || 'Mi Tienda'
    await updateProfile(cred.user, { displayName: cleanStoreName })

    // Si el listener de Auth creó primero el documento, merge garantiza que
    // el nombre elegido durante el registro quede aplicado sin borrar nada.
    await setDoc(doc(db, 'stores', cred.user.uid), {
      ...defaultStore(cred.user, cleanStoreName),
      name: cleanStoreName,
      slug: `${slugify(cleanStoreName)}-${cred.user.uid.slice(0, 6).toLowerCase()}`,
      updatedAt: serverTimestamp(),
    }, { merge: true })

    await ensureAccountSpace(cred.user, cleanStoreName)
    return cred.user
  }

  async function loginWithGoogle() {
    const result = await signInWithPopup(auth, googleProvider)
    await ensureAccountSpace(result.user)
    return result.user
  }


  async function getGooglePhotosAccessToken() {
    const current = auth.currentUser
    if (!current) throw new Error('Debes iniciar sesión antes de conectar Google Photos.')

    const hasGoogle = current.providerData.some(item => item.providerId === 'google.com')
    let result
    try {
      result = hasGoogle
        ? await reauthenticateWithPopup(current, googlePhotosProvider)
        : await linkWithPopup(current, googlePhotosProvider)
    } catch (error) {
      // Si el proveedor quedó enlazado durante un intento anterior, reautoriza para obtener token fresco.
      if (error?.code === 'auth/provider-already-linked') {
        result = await reauthenticateWithPopup(current, googlePhotosProvider)
      } else {
        throw error
      }
    }

    const credential = GoogleAuthProvider.credentialFromResult(result)
    if (!credential?.accessToken) throw new Error('Google no devolvió autorización para Google Photos.')
    return credential.accessToken
  }

  async function logout() {
    setStore(null)
    await signOut(auth)
  }

  return (
    <AuthContext.Provider value={{
      user,
      store,
      setStore,
      reloadStore: () => user && loadStore(user.uid),
      loading,
      login,
      register,
      loginWithGoogle,
      getGooglePhotosAccessToken,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
