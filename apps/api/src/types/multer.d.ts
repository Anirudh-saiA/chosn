/**
 * Minimal ambient declaration for the one `multer` export this codebase
 * actually calls (`diskStorage`, for Legit Check photo uploads — see
 * community/post-images.controller.ts). `@types/multer` isn't installed;
 * a hand-written structural type for the handful of fields/functions
 * actually used avoids a new dependency for a type-only package, same
 * call this repo makes for `UploadedFileLike` in post-images.service.ts.
 */
declare module 'multer' {
  interface MulterFile {
    fieldname: string;
    originalname: string;
    mimetype: string;
    size: number;
    filename: string;
    path: string;
  }

  interface DiskStorageOptions {
    destination?: string;
    filename?: (
      req: unknown,
      file: MulterFile,
      callback: (error: Error | null, filename: string) => void,
    ) => void;
  }

  export function diskStorage(options: DiskStorageOptions): unknown;
}
