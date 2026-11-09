// Stands in for @supabase/storage-js in the build (vite.config.ts, supabaseStubs). The game stores no files in Supabase
// Storage, so this keeps about 9% of the first download out. Using supabase.storage throws: remove the alias to use it.
const unused = () => new Error("Supabase Storage is left out of this build. Remove its alias in web/vite.config.ts to use it.");

export class StorageApiError extends Error {}

export class StorageClient {
  constructor(_url?: string, _headers?: unknown, _fetch?: unknown, _options?: unknown) { /* nothing to set up */ }
  from(_bucket?: string): never { throw unused(); }
  listBuckets(): never { throw unused(); }
  getBucket(_id?: string): never { throw unused(); }
  createBucket(_id?: string, _options?: unknown): never { throw unused(); }
}
