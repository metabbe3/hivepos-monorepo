// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { FormField } from "./form-field";

describe("FormField", () => {
  it("renders the label and a single child input", () => {
    render(
      <FormField label="Name">
        <input data-testid="i" />
      </FormField>,
    );
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByTestId("i")).toBeInTheDocument();
  });

  it("omits the Label entirely when no label is provided", () => {
    const { container } = render(
      <FormField>
        <input />
      </FormField>,
    );
    // No <label> element should be rendered.
    expect(container.querySelector("label")).toBeNull();
  });

  it("shows the required asterisk when required=true", () => {
    render(
      <FormField label="Email" required>
        <input />
      </FormField>,
    );
    expect(screen.getByText("*")).toBeInTheDocument();
  });

  it("shows the error message in destructive color and hides hint", () => {
    render(
      <FormField label="X" error="Bad input" hint="Be careful">
        <input />
      </FormField>,
    );
    expect(screen.getByText("Bad input")).toBeInTheDocument();
    expect(screen.queryByText("Be careful")).toBeNull();
  });

  it("shows the hint when no error is present", () => {
    render(
      <FormField label="X" hint="Helpful hint">
        <input />
      </FormField>,
    );
    expect(screen.getByText("Helpful hint")).toBeInTheDocument();
  });

  it("associates the Label with htmlFor", () => {
    render(
      <FormField label="Email" htmlFor="email-field">
        <input id="email-field" />
      </FormField>,
    );
    const label = screen.getByText("Email").closest("label");
    expect(label?.getAttribute("for")).toBe("email-field");
  });

  it("applies extra className to the outer container", () => {
    const { container } = render(
      <FormField label="X" className="custom-extra">
        <input />
      </FormField>,
    );
    const outer = container.firstChild as HTMLElement;
    expect(outer.className).toContain("custom-extra");
    expect(outer.className).toContain("bg-muted/30");
    expect(outer.className).toContain("border-border/30");
    expect(outer.className).toContain("p-3");
    expect(outer.className).toContain("space-y-1.5");
  });

  it("uses the canonical label styling on the Label", () => {
    render(
      <FormField label="Email">
        <input />
      </FormField>,
    );
    const label = screen.getByText("Email").closest("label");
    expect(label?.className).toContain("text-xs");
    expect(label?.className).toContain("uppercase");
    expect(label?.className).toContain("text-muted-foreground");
  });
});
