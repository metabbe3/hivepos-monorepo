// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  CardListItem,
  CARD_LIST_ITEM_CLASS,
  CARD_LIST_ITEM_INTERACTIVE_CLASS,
} from "./card-list";

describe("CARD_LIST_ITEM_CLASS", () => {
  it("includes the core tailwind classes used across the dashboard", () => {
    expect(CARD_LIST_ITEM_CLASS).toContain("border border-border/40");
    expect(CARD_LIST_ITEM_CLASS).toContain("bg-card");
    expect(CARD_LIST_ITEM_CLASS).not.toContain("dark:bg-gray-800");
    expect(CARD_LIST_ITEM_CLASS).toContain("rounded-xl");
    expect(CARD_LIST_ITEM_CLASS).toContain("shadow-sm");
  });
});

describe("CARD_LIST_ITEM_INTERACTIVE_CLASS", () => {
  it("extends the base class with hover-lift affordances", () => {
    expect(CARD_LIST_ITEM_INTERACTIVE_CLASS).toContain("hover:shadow-md");
    expect(CARD_LIST_ITEM_INTERACTIVE_CLASS).toContain("transition-all");
    expect(CARD_LIST_ITEM_INTERACTIVE_CLASS).toContain("card-clean");
    // Still includes the core classes.
    expect(CARD_LIST_ITEM_INTERACTIVE_CLASS).toContain("rounded-xl");
    expect(CARD_LIST_ITEM_INTERACTIVE_CLASS).toContain("bg-card");
  });
});

describe("CardListItem", () => {
  it("renders the base classes by default", () => {
    const { container } = render(<CardListItem />);
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain("rounded-xl");
    expect(card.className).toContain("bg-card");
    expect(card.className).toContain("shadow-sm");
  });

  it("appends interactive hover classes when interactive=true", () => {
    const { container } = render(<CardListItem interactive />);
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain("hover:shadow-md");
    expect(card.className).toContain("transition-all");
    expect(card.className).toContain("card-clean");
  });

  it("does NOT include interactive classes by default", () => {
    const { container } = render(<CardListItem />);
    const card = container.firstChild as HTMLElement;
    expect(card.className).not.toContain("hover:shadow-md");
    expect(card.className).not.toContain("card-clean");
  });

  it("appends custom className after the shared classes", () => {
    const { container } = render(
      <CardListItem className="custom-flag bg-emerald-50" />,
    );
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain("rounded-xl");
    expect(card.className).toContain("custom-flag");
    expect(card.className).toContain("bg-emerald-50");
  });

  it("renders children inside the Card", () => {
    render(
      <CardListItem>
        <span data-testid="inner">hello</span>
      </CardListItem>,
    );
    expect(screen.getByTestId("inner")).toBeInTheDocument();
  });

  it("forwards arbitrary Card props (e.g. onClick)", () => {
    const onClick = vi.fn();
    const { container } = render(<CardListItem onClick={onClick} data-x="1" />);
    const card = container.firstChild as HTMLElement;
    card.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
