/**
 * Minimal ambient declaration for the `multer` exports this codebase
 * actually calls (`memoryStorage` — Day 26 moved Legit Check photo
 * uploads off disk, see community/post-images.controller.ts).
 * `@types/multer` isn't installed; a hand-written structural type for
 * the handful of fields/functions actually used avoids a new dependency
 * for a type-only package, same call this repo makes for
 * `UploadedFileLike` in post-images.service.ts.
 */
declare module 'multer' {
  interface MulterFile {
    fieldname: string;
    originalname: string;
    mimetype: string;
    size: number;
    /** Only present with memoryStorage — the raw uploaded bytes. */
    buffer: Buffer;
  }

  export function memoryStorage(): unknown;

  interface FileFilterOptions {
    fileFilter?: (
      req: unknown,
      file: MulterFile,
      callback: (error: Error | null, acceptFile?: boolean) => void,
    ) => void;
  }

  export { FileFilterOptions };
}
