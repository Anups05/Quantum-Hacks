import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../firebase'

export const validatePhoneFormat = (phone) => {
  // Matches +91 followed by EXACTLY 10 digits with optional space
  const regex = /^\+91\s?[0-9]{10}$/
  return regex.test(phone)
}

export const checkPhoneUnique = async (phone, currentUserId = null) => {
  const q = query(collection(db, 'users'), where('phoneNumber', '==', phone))
  const snapshot = await getDocs(q)
  
  if (snapshot.empty) return true
  
  // If the query found a document, check if it belongs to the current user
  if (snapshot.docs.length > 0) {
    if (currentUserId && snapshot.docs[0].id === currentUserId) {
      return true
    }
    return false // Number belongs to someone else
  }
  return false
}
