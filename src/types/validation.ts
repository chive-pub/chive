/**
 * Validation types for input data validation.
 *
 * @remarks
 * This module provides types for representing validation results and
 * validator functions. Use these types when implementing validation logic
 * for user input, API requests, or data transformation.
 *
 * Validation results are structured to provide detailed error information
 * per field, enabling user-friendly error messages in forms and APIs.
 *
 * @packageDocumentation
 * @public
 */

/**
 * Validation result for a single field.
 *
 * @remarks
 * Contains validation status and errors for one field in an object or form.
 * Multiple field validation results are combined into a ValidationResult.
 *
 * @example
 * ```typescript
 * const fieldResult: FieldValidationResult = {
 *   field: 'email',
 *   valid: false,
 *   errors: ['Email is required', 'Email must be a valid email address']
 * };
 * ```
 *
 * @public
 */
export interface FieldValidationResult {
  /**
   * Name of the field that was validated.
   *
   * @remarks
   * Use dot notation for nested fields (e.g., 'author.name').
   */
  readonly field: string;

  /**
   * Whether the field passed validation.
   */
  readonly valid: boolean;

  /**
   * Error messages for validation failures.
   *
   * @remarks
   * Only present when `valid` is false. Each error message should be
   * human-readable and suitable for display to users.
   *
   * Empty array or undefined when field is valid.
   */
  readonly errors?: readonly string[];
}

/**
 * Validation result for an entire object.
 *
 * @remarks
 * Aggregates validation results for all fields in an object. The object
 * is valid only if all fields are valid.
 *
 * @example
 * ```typescript
 * const result: ValidationResult = {
 *   valid: false,
 *   errors: [
 *     { field: 'title', valid: false, errors: ['Title is required'] },
 *     { field: 'abstract', valid: true }
 *   ]
 * };
 * ```
 *
 * @public
 */
export interface ValidationResult {
  /**
   * Whether all fields passed validation.
   *
   * @remarks
   * True only if all fields in `errors` array have `valid: true`.
   */
  readonly valid: boolean;

  /**
   * Per-field validation results.
   *
   * @remarks
   * Contains results for all validated fields, including those that passed.
   * Filter by `valid: false` to get only failed validations.
   */
  readonly errors: readonly FieldValidationResult[];
}

/**
 * Type guard validator function.
 *
 * @typeParam T - Type to validate
 *
 * @remarks
 * A validator function that returns true if the value is of type T,
 * false otherwise. TypeScript narrows the type when this function returns true.
 *
 * This is a simple boolean validator. For detailed validation with error
 * messages, use SchemaValidator instead.
 *
 * @example
 * ```typescript
 * const isPositive: Validator<number> = (value): value is number => {
 *   return typeof value === 'number' && value > 0;
 * };
 *
 * const value: unknown = 5;
 * if (isPositive(value)) {
 *   // TypeScript knows value is number here
 *   console.log(value * 2);
 * }
 * ```
 *
 * @public
 */
export type Validator<T> = (value: unknown) => value is T;

/**
 * Schema validator with detailed error reporting.
 *
 * @typeParam T - Type to validate
 *
 * @remarks
 * A validator function that returns a ValidationResult with detailed
 * error messages for each field. If validation succeeds, the result
 * includes the validated value.
 *
 * Use this for complex validation scenarios where you need to report
 * multiple errors to users.
 *
 * @example
 * ```typescript
 * interface User {
 *   name: string;
 *   email: string;
 *   age: number;
 * }
 *
 * const validateUser: SchemaValidator<User> = (value) => {
 *   const errors: FieldValidationResult[] = [];
 *
 *   if (typeof value !== 'object' || value === null) {
 *     return { valid: false, errors: [{ field: 'root', valid: false, errors: ['Value must be an object'] }] };
 *   }
 *
 *   const obj = value as Record<string, unknown>;
 *
 *   if (typeof obj.name !== 'string' || obj.name.length === 0) {
 *     errors.push({ field: 'name', valid: false, errors: ['Name is required'] });
 *   }
 *
 *   if (typeof obj.email !== 'string' || !obj.email.includes('@')) {
 *     errors.push({ field: 'email', valid: false, errors: ['Email must be valid'] });
 *   }
 *
 *   if (typeof obj.age !== 'number' || obj.age < 0) {
 *     errors.push({ field: 'age', valid: false, errors: ['Age must be a positive number'] });
 *   }
 *
 *   if (errors.length > 0) {
 *     return { valid: false, errors };
 *   }
 *
 *   return {
 *     valid: true,
 *     errors: [],
 *     value: obj as User
 *   };
 * };
 * ```
 *
 * @public
 */
export type SchemaValidator<T> = (value: unknown) => ValidationResult & { value?: T };
