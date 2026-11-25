import "server-only";

type BlobStore = Map<string, Uint8Array>;

const globalStore = globalThis as typeof globalThis & { __workroomBlobs?: BlobStore };

function store() {
  if (!globalStore.__workroomBlobs) globalStore.__workroomBlobs = new Map();
  return globalStore.__workroomBlobs;
}

export function putBlob(id: string, bytes: Uint8Array) {
  store().set(id, bytes);
}

export function getBlob(id: string) {
  return store().get(id) ?? null;
}
