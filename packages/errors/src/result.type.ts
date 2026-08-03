export type Result<T, E = Error> =
  | { success: true; data: T; error?: undefined }
  | { success: false; data?: undefined; error: E };

export const ok = <T>(data: T): Result<T, never> => ({
  success: true,
  data,
});

export const err = <E>(error: E): Result<never, E> => ({
  success: false,
  error,
});
