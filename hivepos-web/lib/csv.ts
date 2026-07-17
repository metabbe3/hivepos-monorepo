// ponytail: RFC 4180 CSV. Escapes quotes by doubling, wraps fields with comma/quote/newline in double quotes.
// No streaming — exports are bounded (≤10k rows). For larger, switch to a stream API.
export function toCSV(headers: string[], rows: (string | number | boolean | null | undefined)[][]): string {
  const escape = (v: string | number | boolean | null | undefined): string => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (/[",\n\r]/.test(s)) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const lines = [headers.map(escape).join(",")];
  for (const row of rows) {
    lines.push(row.map(escape).join(","));
  }
  return lines.join("\r\n");
}

// ponytail: hand-rolled RFC 4180 parser (quotes/commas/embedded newlines).
// No streaming — imports are capped client-side. If a 2nd import feature lands,
// swap for a streaming parser (papaparse). Symmetric with toCSV above.
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } // escaped quote
        else inQuotes = false;
      } else {
        field += c; // incl. embedded newline / comma
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\n") {
      row.push(field); rows.push(row); field = ""; row = [];
    } else if (c !== "\r") {
      field += c;
    }
  }
  // Trailing field/row when the file has no final newline.
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

export function csvResponse(filename: string, csv: string): Response {
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}

// ponytail: CSV routes return text/csv, not the JSON envelope. We can't use withErrorHandler
// (which types its return as NextResponse<SuccessEnvelope>). This wrapper gives the same
// auth/validation/error semantics but returns a Response. Errors come back as JSON envelopes
// so the client CsvExportButton can surface them via toast.
export function csvHandler(
  fn: (req: Request) => Promise<Response>,
): (req: Request) => Promise<Response> {
  return async (req) => {
    try {
      return await fn(req);
    } catch (e) {
      const status = csvStatusFor(e);
      const message = e instanceof Error ? e.message : "Export failed";
      return Response.json(
        { error: { code: "EXPORT_ERROR", message } },
        { status },
      );
    }
  };
}

// Local mirror of AppError → HTTP status, avoids importing the error classes
// (keeps this module side-effect-free for easy reuse).
function csvStatusFor(e: unknown): number {
  const name = e?.constructor?.name;
  switch (name) {
    case "UnauthenticatedError": return 401;
    case "ForbiddenError": return 403;
    case "ValidationError":
    case "NotFoundError": return 400;
    case "ConflictError": return 409;
    default: return 500;
  }
}
