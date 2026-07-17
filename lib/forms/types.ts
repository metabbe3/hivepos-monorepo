/**
 * Dynamic Form Type Definitions
 * Core schema system for declarative, reusable forms across all SaaS modules.
 */

// ─── Field Types ─────────────────────────────────────────────
export type FieldType =
  | "text"
  | "email"
  | "password"
  | "tel"
  | "number"
  | "textarea"
  | "select"
  | "date"
  | "datetime-local"
  | "checkbox"
  | "switch"
  | "currency"
  | "tags"          // multi-select tag input
  | "hidden";

// ─── Field Definition ────────────────────────────────────────
export interface FieldDef {
  name: string;
  label?: string;           // i18n key or literal
  labelKey?: string;        // alternative: i18n key
  type: FieldType;
  placeholder?: string;
  placeholderKey?: string;  // i18n key for placeholder
  hint?: string;            // helper text below input
  hintKey?: string;         // i18n key for hint
  required?: boolean;
  disabled?: boolean;
  hidden?: boolean;
  defaultValue?: unknown;
  min?: number;
  max?: number;
  step?: number;
  pattern?: string;
  showPasswordToggle?: boolean; // only for type: "password"
  autocomplete?: string;        // e.g. "email", "current-password" — enables password-manager / Face ID autofill

  // select options (static or async)
  options?: { label: string; value: string }[];
  optionsEndpoint?: string;   // fetch options from API: GET endpoint → { options: [...] }
  optionsLabelKey?: string;   // key in response object for label
  optionsValueKey?: string;   // key in response object for value

  // layout
  colSpan?: 1 | 2 | 3 | 4;    // grid column span (default 2 in 4-col grid on desktop)
  condition?: (values: Record<string, unknown>) => boolean;  // show/hide based on other fields

  // validation
  validate?: (value: unknown, allValues: Record<string, unknown>) => string | null;

  // custom render override
  render?: (props: { value: unknown; onChange: (v: unknown) => void; field: FieldDef; disabled: boolean }) => React.ReactNode;
}

// ─── Form Layout ─────────────────────────────────────────────
export interface FormLayout {
  columns?: 1 | 2 | 3 | 4;        // grid columns on desktop (default 2)
  gap?: "sm" | "md" | "lg";       // gap between fields (default "md")
}

// ─── Form Schema ─────────────────────────────────────────────
export interface FormSchema {
  /** Unique identifier for this form type */
  id: string;

  /** API endpoint for CRUD operations */
  apiEndpoint: string;

  /** HTTP method for create (default POST) / update (default PATCH) */
  method?: "POST" | "PUT" | "PATCH";

  /** Form fields */
  fields: FieldDef[];

  /** Layout configuration */
  layout?: FormLayout;

  /** Submit button text (literal or i18n key) */
  submitLabel?: string;
  submitLabelKey?: string;     // i18n key for submit label

  /** Cancel button text */
  cancelLabel?: string;
  cancelLabelKey?: string;     // i18n key for cancel label

  /** Use apiFetch (typed envelope + cookies) instead of raw fetch. Default true. */
  useApiFetch?: boolean;

  /** Opt all fields into 44px touch-target sizing. Default false (dashboard density). */
  touchTargets?: boolean;

  /** Submit button renders full-width, no add/save icon. For primary auth CTAs (login, register). */
  submitFullWidth?: boolean;

  /** Extra data to merge into payload on submit (e.g. branchId, tenantId) */
  extraData?: Record<string, unknown>;

  /** Transform values before sending to API */
  transform?: (values: Record<string, unknown>) => Record<string, unknown>;

  /** Modal or inline form */
  variant?: "modal" | "inline";

  /** Success message */
  successMessage?: string;

  /** Whether this form supports editing (pass recordId to edit) */
  editable?: boolean;

  /** Show in a dialog by default */
  dialogTitle?: string;
}

// ─── Generic CRUD Result ─────────────────────────────────────
export interface FormSubmitResult {
  ok: boolean;
  data?: Record<string, unknown>;
  error?: string;
}
