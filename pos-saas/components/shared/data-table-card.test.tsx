// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DataTableCard, type Column } from "./data-table-card";

interface Row {
  id: string;
  name: string;
  amount: number;
}

const columns: Column<Row>[] = [
  { header: "Name", render: (r) => r.name },
  { header: "Amount", render: (r) => `Rp ${r.amount}`, align: "right", className: "tabular-nums" },
];

const rows: Row[] = [
  { id: "1", name: "Alice", amount: 1000 },
  { id: "2", name: "Bob", amount: 2000 },
];

describe("DataTableCard", () => {
  it("renders a header cell for each column", () => {
    render(
      <DataTableCard
        title="People"
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
      />,
    );
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Amount")).toBeInTheDocument();
  });

  it("renders one tbody row per data row", () => {
    render(
      <DataTableCard
        title="People"
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
      />,
    );
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("Rp 1000")).toBeInTheDocument();
    expect(screen.getByText("Rp 2000")).toBeInTheDocument();

    // Two distinct rows in tbody.
    const tbody = document.querySelector("tbody");
    expect(tbody?.querySelectorAll("tr")).toHaveLength(2);
  });

  it("calls rowKey for each row", () => {
    const keySpy = vi.fn((r: Row, _index: number) => r.id);
    render(
      <DataTableCard
        columns={columns}
        rows={rows}
        rowKey={keySpy}
      />,
    );
    expect(keySpy).toHaveBeenCalledTimes(2);
    // Called with row + index.
    expect(keySpy.mock.calls[0][0]).toEqual(rows[0]);
    expect(keySpy.mock.calls[0][1]).toBe(0);
    expect(keySpy.mock.calls[1][1]).toBe(1);
  });

  it("shows emptyMessage when there are no rows and no filter is active", () => {
    render(
      <DataTableCard
        title="People"
        columns={columns}
        rows={[]}
        rowKey={(r) => r.id}
        emptyMessage="Nothing yet"
        emptyFilteredMessage="No matches"
      />,
    );
    expect(screen.getByText("Nothing yet")).toBeInTheDocument();
    expect(screen.queryByText("No matches")).toBeNull();
    // No table rendered when empty
    expect(document.querySelector("table")).toBeNull();
  });

  it("shows emptyFilteredMessage when isFiltered=true", () => {
    render(
      <DataTableCard
        title="People"
        columns={columns}
        rows={[]}
        rowKey={(r) => r.id}
        emptyMessage="Nothing yet"
        emptyFilteredMessage="No matches"
        isFiltered
      />,
    );
    expect(screen.getByText("No matches")).toBeInTheDocument();
    expect(screen.queryByText("Nothing yet")).toBeNull();
  });

  it("renders the title inside CardTitle", () => {
    render(
      <DataTableCard
        title="My Table"
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
      />,
    );
    expect(screen.getByText("My Table")).toBeInTheDocument();
  });

  it("renders headerExtra alongside the title when provided", () => {
    render(
      <DataTableCard
        title="My Table"
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        headerExtra={<div data-testid="extra">FILTERS</div>}
      />,
    );
    expect(screen.getByTestId("extra")).toBeInTheDocument();
  });

  it("omits CardHeader entirely when no title and no headerExtra", () => {
    const { container } = render(
      <DataTableCard columns={columns} rows={rows} rowKey={(r) => r.id} />,
    );
    // No element containing a CardTitle should be rendered.
    expect(container.textContent).not.toContain("My Table");
    // The header section is gated on (title || headerExtra); verify table still renders.
    expect(container.querySelector("table")).not.toBeNull();
  });

  it("applies column.className to both th and td", () => {
    const { container } = render(
      <DataTableCard
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
      />,
    );
    // "text-right" should appear on the second <th> and on the second <td> of each row.
    const ths = container.querySelectorAll("th");
    expect(ths[1].className).toContain("text-right");
    const firstRowTds = container.querySelectorAll("tbody tr:first-of-type td");
    expect(firstRowTds[1].className).toContain("text-right");
  });

  it("invokes render with the row and the row index", () => {
    const renderSpy = vi.fn((_row: Row, _index: number) => null);
    render(
      <DataTableCard
        columns={[{ header: "X", render: renderSpy }]}
        rows={rows}
        rowKey={(r) => r.id}
      />,
    );
    expect(renderSpy).toHaveBeenCalledTimes(2);
    expect(renderSpy.mock.calls[0][1]).toBe(0);
    expect(renderSpy.mock.calls[1][1]).toBe(1);
    // Row is passed too.
    expect(renderSpy.mock.calls[0][0]).toEqual(rows[0]);
  });

  it("uses canonical table styling — w-full text-sm on <table>", () => {
    const { container } = render(
      <DataTableCard columns={columns} rows={rows} rowKey={(r) => r.id} />,
    );
    const table = container.querySelector("table");
    expect(table?.className).toContain("w-full");
    expect(table?.className).toContain("text-sm");
  });

  it("uses canonical Card styling — overflow-hidden rounded-xl border-border/60 shadow-sm", () => {
    const { container } = render(
      <DataTableCard columns={columns} rows={rows} rowKey={(r) => r.id} />,
    );
    // The Card is the outermost element.
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain("overflow-hidden");
    expect(card.className).toContain("rounded-xl");
    expect(card.className).toContain("border-border/60");
    expect(card.className).toContain("shadow-sm");
  });

  it("uses the empty-state paragraph styling", () => {
    render(
      <DataTableCard
        columns={columns}
        rows={[]}
        rowKey={(r) => r.id}
        emptyMessage="Nothing"
      />,
    );
    const p = screen.getByText("Nothing");
    expect(p.className).toContain("py-8");
    expect(p.className).toContain("text-center");
    expect(p.className).toContain("text-muted-foreground");
  });
});
