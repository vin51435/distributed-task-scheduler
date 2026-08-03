import { registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator';

export function IsValidTimezone(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isValidTimezone',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any) {
          if (value === undefined || value === null) return true;
          if (typeof value !== 'string') return false;
          try {
            Intl.DateTimeFormat(undefined, { timeZone: value });
            return true;
          } catch {
            return false;
          }
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a valid IANA timezone name`;
        },
      },
    });
  };
}
