import { Type, type Static } from '@sinclair/typebox';
const RequestIdSchema = Type.String({
  pattern:
    '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
});
const IsoTimestampSchema = Type.String({
  pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{3})?Z$',
});
export const HealthSchema = Type.Object(
  { status: Type.Literal('ok'), request_id: RequestIdSchema },
  { additionalProperties: false },
);
export const ErrorSchema = Type.Object(
  { code: Type.String(), message: Type.String(), request_id: RequestIdSchema },
  { additionalProperties: false },
);
export const MeSchema = Type.Object(
  {
    id: Type.String({ pattern: '^usr_[A-Za-z0-9_-]{16,64}$' }),
    kind: Type.Literal('consumer'),
    status: Type.Literal('active'),
    locale: Type.String({ pattern: '^[a-z]{2}(?:-[A-Z]{2})?$' }),
    timezone: Type.String({ minLength: 1, maxLength: 64 }),
    created_at: IsoTimestampSchema,
    updated_at: IsoTimestampSchema,
    request_id: RequestIdSchema,
  },
  { additionalProperties: false },
);
export type HealthResponse = Static<typeof HealthSchema>;
export type ErrorResponse = Static<typeof ErrorSchema>;
export type MeResponse = Static<typeof MeSchema>;
