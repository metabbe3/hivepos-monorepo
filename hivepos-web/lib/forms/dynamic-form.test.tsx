// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeAll } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DynamicForm } from "./dynamic-form";
import type { FormSchema } from "./types";

// jsdom 29 under vitest 4 exposes `window.localStorage` as a non-Storage object
// (no getItem/setItem). apiFetch reads the JWT via window.localStorage.getItem,
// so the built-in fetch path crashes before the mocked fetch runs. Provide a
// minimal in-memory Storage so apiFetch is testable without a real browser.
beforeAll(() => {
  if (typeof window !== "undefined" && typeof window.localStorage?.getItem !== "function") {
    const store = new Map<string, string>();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, String(v)),
        removeItem: (k: string) => void store.delete(k),
        clear: () => store.clear(),
        key: (i: number) => Array.from(store.keys())[i] ?? null,
        get length() { return store.size; },
      },
    });
  }
});

// Mock next/navigation — useRouter.refresh()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

// Mock sonner toast so assertions don't depend on Toaster mounting.
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// useTranslation returns `t` that just echoes the key (no i18n provider needed).
vi.mock("@/hooks/use-translation", () => ({
  useTranslation: () => ({ t: (key: string) => key, lang: "en", setLang: vi.fn() }),
}));

const baseSchema: FormSchema = {
  id: "test",
  apiEndpoint: "/api/test",
  fields: [
    {
      name: "email",
      label: "Email",
      type: "email",
      required: true,
      validate: (v) => (!String(v).includes("@") ? "Bad email" : null),
    },
    {
      name: "password",
      label: "Password",
      type: "password",
      required: true,
      showPasswordToggle: true,
      validate: (v) => (String(v).length < 4 ? "Too short" : null),
    },
  ],
  layout: { columns: 1 },
};

afterEach(() => vi.clearAllMocks());

describe("DynamicForm", () => {
  it("runs validate on blur and clears the error on fix", async () => {
    // handleBlur only validates a field once it's been touched (or after a
    // submit attempt) — otherwise an autofocused empty required field errors
    // the moment another field is clicked (BUGS-E2E-FINDINGS #7). So the real
    // user flow is: type an invalid value (touch) → blur (validate shows error)
    // → fix → blur (error clears). Typing a real value (not "") is required:
    // React skips onChange when the DOM value already equals the controlled
    // value, so fireEvent.change({value:""}) never marks the field touched.
    const user = userEvent.setup();
    render(<DynamicForm schema={baseSchema} hideActions />);

    const emailInput = screen.getByLabelText(/^Email/);
    await user.type(emailInput, "nope"); // invalid → marks touched
    fireEvent.blur(emailInput);
    await waitFor(() => expect(screen.getByText("Bad email")).toBeInTheDocument());

    await user.clear(emailInput);
    await user.type(emailInput, "a@b.com");
    fireEvent.blur(emailInput);
    await waitFor(() => expect(screen.queryByText("Bad email")).not.toBeInTheDocument());
  });

  it("password toggle flips input type between password and text", async () => {
    render(<DynamicForm schema={baseSchema} hideActions />);
    const passwordInput = screen.getByLabelText(/^Password/);
    expect(passwordInput).toHaveAttribute("type", "password");

    fireEvent.click(screen.getByLabelText("Show password"));
    expect(passwordInput).toHaveAttribute("type", "text");

    fireEvent.click(screen.getByLabelText("Hide password"));
    expect(passwordInput).toHaveAttribute("type", "password");
  });

  it("onSubmit override bypasses the built-in fetch", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    render(<DynamicForm schema={baseSchema} onSubmit={onSubmit} />);
    await user.type(screen.getByLabelText(/^Email/), "a@b.com");
    await user.type(screen.getByLabelText(/^Password/), "pass");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ email: "a@b.com", password: "pass" });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("built-in fetch path uses apiFetch and surfaces ApiClientError on non-ok", async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 422,
      json: () => Promise.resolve({ success: false, error: { code: "X", message: "boom" } }),
    } as Response);

    const { toast } = await import("sonner");
    render(<DynamicForm schema={baseSchema} />);
    await user.type(screen.getByLabelText(/^Email/), "a@b.com");
    await user.type(screen.getByLabelText(/^Password/), "pass");
    await user.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("boom"));
    fetchSpy.mockRestore();
  });

  it("falls back to field name when labelKey is unresolved and no literal is set", () => {
    const schema: FormSchema = {
      id: "i18n-test",
      apiEndpoint: "/api/x",
      fields: [{ name: "name", labelKey: "common.name", type: "text" }],
      layout: { columns: 1 },
    };
    render(<DynamicForm schema={schema} hideActions />);
    // t() is mocked pass-through → labelKey "common.name" is unresolved, no
    // literal → resolveText falls back to the field name "name".
    expect(screen.getByText("name")).toBeInTheDocument();
  });

  it("touchTargets propagates to submit button size", () => {
    render(<DynamicForm schema={{ ...baseSchema, touchTargets: true }} />);
    const btn = screen.getByRole("button", { name: "Submit" });
    expect(btn.className).toContain("h-11");
  });
});
