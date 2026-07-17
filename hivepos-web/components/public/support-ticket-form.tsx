"use client";

import { useState } from "react";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { TICKET_CATEGORIES } from "@/lib/tickets-constants";

type Status = "idle" | "submitting" | "success" | "error";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-foreground placeholder:text-slate-400 outline-none transition-all focus:border-brand/50 focus:ring-2 focus:ring-brand/20";

export function SupportTicketForm({ tenantSlug = "" }: { tenantSlug?: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");
    setErrorMsg("");
    try {
      const fd = new FormData(e.currentTarget);
      const payload = {
        subject: String(fd.get("subject") ?? "").trim(),
        description: String(fd.get("description") ?? "").trim(),
        category: String(fd.get("category") ?? "OTHER"),
        submitterName: String(fd.get("submitterName") ?? "").trim(),
        submitterEmail: String(fd.get("submitterEmail") ?? "").trim(),
        submitterPhone: String(fd.get("submitterPhone") ?? "").trim(),
        tenantSlug,
      };
      if (payload.subject.length < 5) {
        throw new Error("Subjek terlalu pendek — minimal 5 huruf.");
      }
      if (payload.description.length < 10) {
        throw new Error("Deskripsi terlalu pendek — minimal 10 huruf.");
      }
      if (!payload.submitterName) {
        throw new Error("Nama wajib diisi.");
      }
      if (!payload.submitterEmail.includes("@")) {
        throw new Error("Format email salah.");
      }

      const res = await fetch("/api/public/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? `Submission failed (${res.status})`);
      }
      setStatus("success");
      e.currentTarget.reset();
    } catch (e) {
      setStatus("error");
      setErrorMsg(e instanceof Error ? e.message : "Submission failed");
    }
  }

  if (status === "success") {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center">
        <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-emerald-500" />
        <h2 className="text-xl font-bold text-slate-900">Ticket submitted</h2>
        <p className="mt-1 text-sm text-slate-600">
          Our team will reach out by email. Thank you.
        </p>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="mt-4 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Submit another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
      <div>
        <label htmlFor="subject" className="mb-1.5 block text-sm font-medium text-slate-700">
          Subject
        </label>
        <input
          id="subject"
          name="subject"
          type="text"
          required
          minLength={5}
          maxLength={200}
          className={inputClass}
          placeholder="Brief summary of your issue"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="category" className="mb-1.5 block text-sm font-medium text-slate-700">
            Category
          </label>
          <select id="category" name="category" className={inputClass} defaultValue="OTHER">
            {TICKET_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c.charAt(0) + c.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="submitterPhone" className="mb-1.5 block text-sm font-medium text-slate-700">
            Phone (optional)
          </label>
          <input
            id="submitterPhone"
            name="submitterPhone"
            type="tel"
            className={inputClass}
            placeholder="08xx"
          />
        </div>
      </div>

      <div>
        <label htmlFor="description" className="mb-1.5 block text-sm font-medium text-slate-700">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          required
          minLength={10}
          maxLength={5000}
          rows={5}
          className={inputClass}
          placeholder="Tell us what happened, what you expected, and any steps you already tried."
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="submitterName" className="mb-1.5 block text-sm font-medium text-slate-700">
            Your name
          </label>
          <input
            id="submitterName"
            name="submitterName"
            type="text"
            required
            maxLength={120}
            className={inputClass}
            placeholder="Full name"
          />
        </div>
        <div>
          <label htmlFor="submitterEmail" className="mb-1.5 block text-sm font-medium text-slate-700">
            Email
          </label>
          <input
            id="submitterEmail"
            name="submitterEmail"
            type="email"
            required
            className={inputClass}
            placeholder="you@example.com"
          />
        </div>
      </div>

      {status === "error" && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={status === "submitting"}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-brand/90 disabled:opacity-60"
      >
        {status === "submitting" && <Loader2 className="h-4 w-4 animate-spin" />}
        {status === "submitting" ? "Submitting…" : "Submit ticket"}
      </button>
    </form>
  );
}
