/**
 * Plain-text + minimal HTML email templates for ticket events.
 * ponytail: template literals, no template engine. Lift to MJML/Mustache if
 * templates start needing conditional sections or shared layouts.
 */
import { getAdminTicket } from "@/lib/tickets-admin";

// ponytail: local map — emails are English-only by convention, no i18n.
const STATUS_LABELS: Record<string, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

interface ReplyEmailInput {
  ticketId: string;
  ticketSubject: string;
  submitterName: string;
  replyAuthor: string;
  replyBody: string;
  appUrl: string;
}

export function ticketReplyEmail(input: ReplyEmailInput) {
  const url = `${input.appUrl}/tickets/${input.ticketId}`;
  const text = [
    `Hi ${input.submitterName || "there"},`,
    ``,
    `${input.replyAuthor} replied to your ticket "${input.ticketSubject}":`,
    ``,
    input.replyBody,
    ``,
    `View the full thread: ${url}`,
    ``,
    `— hivePOS Support`,
  ].join("\n");

  const html = `
    <div style="font-family: ui-sans-serif, system-ui; max-width: 560px; margin: 0 auto;">
      <h2 style="color: #4f46e5;">New reply on your ticket</h2>
      <p>Hi ${input.submitterName || "there"},</p>
      <p><strong>${input.replyAuthor}</strong> replied to <em>${input.ticketSubject}</em>:</p>
      <blockquote style="border-left: 3px solid #e5e7eb; padding: 8px 12px; color: #4b5563; margin: 16px 0;">
        ${input.replyBody.replace(/\n/g, "<br/>")}
      </blockquote>
      <p><a href="${url}" style="color: #4f46e5;">View full thread →</a></p>
      <p style="color: #9ca3af; font-size: 12px; margin-top: 32px;">— hivePOS Support</p>
    </div>
  `;

  return {
    subject: `Re: ${input.ticketSubject}`,
    text,
    html,
  };
}

interface StatusEmailInput {
  ticketId: string;
  ticketSubject: string;
  submitterName: string;
  newStatus: string;
  appUrl: string;
}

export function ticketStatusEmail(input: StatusEmailInput) {
  const url = `${input.appUrl}/tickets/${input.ticketId}`;
  const statusLabel = STATUS_LABELS[input.newStatus] ?? input.newStatus;
  const text = [
    `Hi ${input.submitterName || "there"},`,
    ``,
    `Your ticket "${input.ticketSubject}" was updated to: ${statusLabel}`,
    ``,
    `View: ${url}`,
    ``,
    `— hivePOS Support`,
  ].join("\n");

  const html = `
    <div style="font-family: ui-sans-serif, system-ui; max-width: 560px; margin: 0 auto;">
      <h2 style="color: #4f46e5;">Ticket status updated</h2>
      <p>Hi ${input.submitterName || "there"},</p>
      <p>Your ticket <em>${input.ticketSubject}</em> is now <strong>${statusLabel}</strong>.</p>
      <p><a href="${url}" style="color: #4f46e5;">View ticket →</a></p>
      <p style="color: #9ca3af; font-size: 12px; margin-top: 32px;">— hivePOS Support</p>
    </div>
  `;

  return {
    subject: `[${statusLabel}] ${input.ticketSubject}`,
    text,
    html,
  };
}

// Helper to fetch what we need to email about without leaking types.
export async function loadTicketForEmail(ticketId: string) {
  return getAdminTicket(ticketId);
}
