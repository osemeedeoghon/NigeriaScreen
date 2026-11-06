/** Result returned by account form Server Actions to `useActionState`. */
export interface FormState {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string | undefined>;
  /** Non-secret values to put back in the form (React resets forms after an action). */
  values?: Record<string, string>;
}

export const IDLE: FormState = { status: "idle" };
