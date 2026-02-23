import { z } from 'zod';
import type { ZodTypeAny } from 'zod';

/**
 * Convert a Zod schema to a JSON Schema object suitable for LLM tool definitions.
 * This is a lightweight implementation covering the most common Zod types.
 */
export function zodToJsonSchema(schema: ZodTypeAny): Record<string, unknown> {
  return convertZodType(schema);
}

function convertZodType(schema: ZodTypeAny): Record<string, unknown> {
  // Unwrap ZodOptional, ZodNullable, ZodDefault
  if (schema instanceof z.ZodOptional) {
    return convertZodType(schema.unwrap());
  }
  if (schema instanceof z.ZodNullable) {
    const inner = convertZodType(schema.unwrap());
    return { ...inner, nullable: true };
  }
  if (schema instanceof z.ZodDefault) {
    return convertZodType(schema._def.innerType as z.ZodTypeAny);
  }

  if (schema instanceof z.ZodObject) {
    const shape = schema.shape as Record<string, z.ZodTypeAny>;
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      properties[key] = convertZodType(value);
      if (!(value instanceof z.ZodOptional) && !(value instanceof z.ZodDefault)) {
        required.push(key);
      }
    }

    const result: Record<string, unknown> = {
      type: 'object',
      properties,
    };
    if (required.length > 0) result['required'] = required;
    return result;
  }

  if (schema instanceof z.ZodString) {
    const result: Record<string, unknown> = { type: 'string' };
    const desc = schema.description;
    if (desc) result['description'] = desc;
    return result;
  }

  if (schema instanceof z.ZodNumber) {
    const result: Record<string, unknown> = { type: 'number' };
    const desc = schema.description;
    if (desc) result['description'] = desc;
    return result;
  }

  if (schema instanceof z.ZodBoolean) {
    return { type: 'boolean' };
  }

  if (schema instanceof z.ZodArray) {
    return {
      type: 'array',
      items: convertZodType(schema.element),
    };
  }

  if (schema instanceof z.ZodEnum) {
    return {
      type: 'string',
      enum: schema.options as string[],
    };
  }

  if (schema instanceof z.ZodNativeEnum) {
    const values = Object.values(schema.enum) as string[];
    return { type: 'string', enum: values };
  }

  if (schema instanceof z.ZodUnion) {
    return {
      oneOf: (schema.options as z.ZodTypeAny[]).map(convertZodType),
    };
  }

  if (schema instanceof z.ZodRecord) {
    return {
      type: 'object',
      additionalProperties: convertZodType(schema._def.valueType as z.ZodTypeAny),
    };
  }

  if (schema instanceof z.ZodLiteral) {
    return { const: schema.value };
  }

  // Fallback
  return { type: 'string' };
}
