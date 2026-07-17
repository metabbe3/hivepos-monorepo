// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

describe("frontend test pipeline", () => {
  it("renders JSX and resolves jest-dom matchers", () => {
    render(<div data-testid="hello">Hello, world!</div>);
    const el = screen.getByTestId("hello");
    expect(el).toBeInTheDocument();
    expect(el).toHaveTextContent("Hello, world!");
  });

  it("provides a DOM environment (window & document)", () => {
    expect(typeof window).toBe("object");
    expect(typeof document).toBe("object");
    const div = document.createElement("div");
    div.textContent = "ping";
    document.body.appendChild(div);
    expect(document.body.textContent).toContain("ping");
  });
});
