import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { Allocation, UserPreferences } from '../types';

const ALLOC_COLLECTION = 'allocations';
const PREFS_COLLECTION = 'settings';
const PREFS_DOC_ID = 'preferences';

export async function loadAllocations(): Promise<Allocation[]> {
  const snap = await getDocs(collection(db, ALLOC_COLLECTION));
  return snap.docs
    .map(d => ({ id: d.id, ...(d.data() as Omit<Allocation, 'id'>) }))
    .sort((a, b) => a.symbol.localeCompare(b.symbol));
}

export async function saveAllocations(allocations: Allocation[]): Promise<void> {
  const batch = writeBatch(db);

  const existing = await getDocs(collection(db, ALLOC_COLLECTION));
  existing.docs.forEach(d => batch.delete(d.ref));

  allocations.forEach((alloc, i) => {
    const ref = doc(
      collection(db, ALLOC_COLLECTION),
      `alloc_${String(i).padStart(3, '0')}`,
    );
    batch.set(ref, { symbol: alloc.symbol, allocation: alloc.allocation });
  });

  await batch.commit();
}

export async function loadPreferences(): Promise<UserPreferences> {
  const ref = doc(db, PREFS_COLLECTION, PREFS_DOC_ID);
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data() as UserPreferences) : {};
}

export async function savePreferences(
  prefs: Partial<UserPreferences>,
): Promise<void> {
  const ref = doc(db, PREFS_COLLECTION, PREFS_DOC_ID);
  await setDoc(ref, prefs, { merge: true });
}
