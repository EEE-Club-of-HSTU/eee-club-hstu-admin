import { doc, runTransaction, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "./firebase";
import { isValidInt } from "./format";

/**
 * Sets boolean flags (e.g. published, featured) on one document without
 * rewriting its other fields, so edits made elsewhere are never reverted.
 * Returns the updatedAt timestamp written.
 */
export async function setFlags(
  collectionName: string,
  id: string,
  flags: Record<string, boolean>
): Promise<number> {
  const updatedAt = Date.now();
  await updateDoc(doc(db, collectionName, id), { ...flags, updatedAt });
  return updatedAt;
}

/**
 * Moves the item at `index` one step up or down within `visibleIds`.
 * Normally swaps `order` with the neighbour in a transaction that reads both
 * current values. If either order is missing or they are tied, renumbers only
 * the visible list. Returns the new order of every document it changed.
 */
export async function moveInOrder(
  collectionName: string,
  visibleIds: string[],
  index: number,
  direction: -1 | 1
): Promise<{ orders: Map<string, number>; updatedAt: number }> {
  const target = index + direction;
  const updatedAt = Date.now();
  if (target < 0 || target >= visibleIds.length) {
    return { orders: new Map(), updatedAt };
  }
  const aId = visibleIds[index];
  const bId = visibleIds[target];

  const swapped = await runTransaction(db, async (tx) => {
    const aRef = doc(db, collectionName, aId);
    const bRef = doc(db, collectionName, bId);
    const [a, b] = await Promise.all([tx.get(aRef), tx.get(bRef)]);
    if (!a.exists() || !b.exists()) {
      throw new Error("One of these items was deleted. Reload the page and try again.");
    }
    const aOrder: unknown = a.data().order;
    const bOrder: unknown = b.data().order;
    if (!isValidInt(aOrder) || !isValidInt(bOrder) || aOrder === bOrder) return null;
    tx.update(aRef, { order: bOrder, updatedAt });
    tx.update(bRef, { order: aOrder, updatedAt });
    return new Map<string, number>([
      [aId, bOrder],
      [bId, aOrder],
    ]);
  });
  if (swapped) return { orders: swapped, updatedAt };

  // Orders are missing or tied: renumber just this visible list in its new sequence.
  const ids = [...visibleIds];
  const [moved] = ids.splice(index, 1);
  ids.splice(target, 0, moved);
  const batch = writeBatch(db);
  const orders = new Map<string, number>();
  ids.forEach((id, i) => {
    batch.update(doc(db, collectionName, id), { order: i, updatedAt });
    orders.set(id, i);
  });
  await batch.commit();
  return { orders, updatedAt };
}
