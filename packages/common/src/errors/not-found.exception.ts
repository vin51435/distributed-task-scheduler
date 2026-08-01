import { AppError } from './app-error';

export class NotFoundException extends AppError {
  public readonly statusCode = 404;
  public readonly errorCode = 'RESOURCE_NOT_FOUND';

  constructor(resource: string, identifier: string | number) {
    super(`${resource} with identifier '${identifier}' was not found.`, {
      resource,
      identifier,
    });
  }
}
