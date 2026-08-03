import { registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator';
import { CronExpressionParser } from 'cron-parser';

export function IsValidCron(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isValidCron',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any) {
          if (value === undefined || value === null) return true;
          if (typeof value !== 'string') return false;
          try {
            CronExpressionParser.parse(value);
            return true;
          } catch {
            return false;
          }
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a valid cron expression`;
        },
      },
    });
  };
}
