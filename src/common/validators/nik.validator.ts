import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'IsValidNIK', async: false })
export class IsValidNIKConstraint implements ValidatorConstraintInterface {
  validate(value: any): boolean {
    if (!value) return true; // allow empty (use @IsNotEmpty separately if required)
    return /^\d{16}$/.test(String(value));
  }

  defaultMessage(): string {
    return 'NIK harus 16 digit angka';
  }
}

export function IsValidNIK(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsValidNIKConstraint,
    });
  };
}
