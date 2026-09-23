import { registerDecorator, ValidationOptions } from 'class-validator';
import { isValid, startOfToday } from 'date-fns';

/**
 * The date must be today or later, evaluated on every request. `@MinDate(new
 * Date())` evaluates once at module load and goes stale while the process runs.
 */
export function IsNotInPast(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string) =>
    registerDecorator({
      name: 'isNotInPast',
      target: object.constructor,
      propertyName,
      options: {
        message: `${propertyName} cannot be in the past`,
        ...validationOptions,
      },
      validator: {
        validate: (value: unknown) =>
          value instanceof Date && isValid(value) && value >= startOfToday(),
      },
    });
}
