"use client";

// ponytail: single source of truth for audit action rendering.
// ACTION_COLORS drives the semantic color; ACTION_LABELS drives the friendly
// text shown in the badge. Both fall through to defaults for unmapped actions
// so future audit entries still render until added here. The raw `action`
// string stays accessible via the title tooltip for debugging / CSV cross-ref.

const ACTION_COLORS: Record<string, string> = {
  // tenant lifecycle
  "tenant.approve": "bg-emerald-100/80 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300",
  "tenant.suspend": "bg-red-100/80 text-red-600 dark:bg-red-900/40 dark:text-red-300",
  "tenant.reactivate": "bg-emerald-100/80 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300",
  // user management
  "user.suspend": "bg-red-100/80 text-red-600 dark:bg-red-900/40 dark:text-red-300",
  "user.reactivate": "bg-emerald-100/80 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300",
  "user.reset_password": "bg-amber-100/80 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300",
  "user.impersonate": "bg-amber-100/80 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300",
  // subscription / billing
  "subscription.extend_trial": "bg-emerald-100/80 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300",
  "subscription.cancel": "bg-red-100/80 text-red-600 dark:bg-red-900/40 dark:text-red-300",
  "subscription.change_plan": "bg-amber-100/80 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300",
  "subscription.mark_paid": "bg-emerald-100/80 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300",
  "billing.refund": "bg-amber-100/80 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300",
  // plan management
  "plan.create": "bg-emerald-100/80 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300",
  "plan.delete": "bg-red-100/80 text-red-600 dark:bg-red-900/40 dark:text-red-300",
  // super-admin self / peers
  "admin.revoke_sessions": "bg-amber-100/80 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300",
  "admin.change_password": "bg-amber-100/80 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300",
  "admin.create": "bg-emerald-100/80 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300",
  "admin.update_role": "bg-amber-100/80 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300",
  "admin.deactivate": "bg-red-100/80 text-red-600 dark:bg-red-900/40 dark:text-red-300",
  // support tickets
  "ticket.update_status": "bg-amber-100/80 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300",
  "ticket.update_priority": "bg-amber-100/80 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300",
  // error logs
  "errorlog.resolve": "bg-emerald-100/80 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300",
};

const ACTION_LABELS: Record<string, string> = {
  // tenant lifecycle
  "tenant.approve": "Approved Tenant",
  "tenant.suspend": "Suspended Tenant",
  "tenant.reactivate": "Reactivated Tenant",
  // user management
  "user.suspend": "Suspended User",
  "user.reactivate": "Reactivated User",
  "user.reset_password": "Reset Password",
  "user.impersonate": "Impersonated User",
  "user.impersonate_stop": "Stopped Impersonation",
  // subscription / billing
  "subscription.extend_trial": "Extended Trial",
  "subscription.cancel": "Cancelled Subscription",
  "subscription.change_plan": "Changed Plan",
  "subscription.mark_paid": "Marked Paid",
  "billing.refund": "Refunded Payment",
  // plan management
  "plan.create": "Created Plan",
  "plan.delete": "Deleted Plan",
  // super-admin self / peers
  "admin.revoke_sessions": "Revoked Sessions",
  "admin.change_password": "Changed Password",
  "admin.create": "Created Admin",
  "admin.update_role": "Updated Admin Role",
  "admin.deactivate": "Deactivated Admin",
  // support tickets
  "ticket.reply": "Replied to Ticket",
  "ticket.update_status": "Updated Ticket Status",
  "ticket.update_priority": "Updated Ticket Priority",
  // error logs
  "errorlog.resolve": "Resolved Error",
  // exports
  "users.export": "Exported Users",
};

export function AuditActionBadge({ action }: { action: string }) {
  const label = ACTION_LABELS[action] ?? action;
  return (
    <span
      title={action}
      className={`inline-flex items-center rounded-full border border-transparent px-2 py-0.5 text-xs font-medium ${
        ACTION_COLORS[action] ?? "bg-muted text-muted-foreground"
      }`}
    >
      {label}
    </span>
  );
}
