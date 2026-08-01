import { AppError } from './app-error';

export class ValidationException extends AppError {
  public readonly statusCode = 400;
  public readonly errorCode = 'VALIDATION_FAILED';

  constructor(
    message: string,
    public readonly validationErrors?: Record<string, string[]>,
  ) {
    super(message, { validationErrors });
  }
}
