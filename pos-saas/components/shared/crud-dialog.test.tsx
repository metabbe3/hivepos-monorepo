// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CrudDialog } from "./crud-dialog";

describe("CrudDialog", () => {
  it("renders the title inside DialogTitle when open", () => {
    render(
      <CrudDialog open={true} onOpenChange={() => {}} title="Create Branch">
        <span>body</span>
      </CrudDialog>,
    );
    expect(screen.getByText("Create Branch")).toBeInTheDocument();
  });

  it("renders the icon before the title", () => {
    render(
      <CrudDialog
        open={true}
        onOpenChange={() => {}}
        title="New"
        icon={<span data-testid="icon">ICN</span>}
      >
        <span>body</span>
      </CrudDialog>,
    );
    const title = screen.getByText("New").closest("h2, [class*=\"DialogTitle\"]");
    const titleParent = screen.getByText("New").parentElement;
    expect(titleParent?.querySelector("[data-testid='icon']")).not.toBeNull();
  });

  it("renders children in the dialog body when open", () => {
    render(
      <CrudDialog open={true} onOpenChange={() => {}} title="T">
        <div data-testid="child">hello</div>
      </CrudDialog>,
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("renders the footer slot after children", () => {
    render(
      <CrudDialog
        open={true}
        onOpenChange={() => {}}
        title="T"
        footer={<div data-testid="foot">submit</div>}
      >
        <div data-testid="child">body</div>
      </CrudDialog>,
    );
    const child = screen.getByTestId("child");
    const foot = screen.getByTestId("foot");
    expect(foot).toBeInTheDocument();
    // Footer appears after children in DOM order within DialogContent.
    expect(child.compareDocumentPosition(foot)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("accepts a ReactNode title (not just string)", () => {
    render(
      <CrudDialog
        open={true}
        onOpenChange={() => {}}
        title={<span data-testid="title-node">Edit Branch</span>}
      >
        <span>body</span>
      </CrudDialog>,
    );
    expect(screen.getByTestId("title-node")).toBeInTheDocument();
  });

  it("renders nothing visible when open=false (Radix unmounts content)", () => {
    render(
      <CrudDialog open={false} onOpenChange={() => {}} title="Hidden">
        <span>secret body</span>
      </CrudDialog>,
    );
    expect(screen.queryByText("Hidden")).toBeNull();
    expect(screen.queryByText("secret body")).toBeNull();
  });
});
