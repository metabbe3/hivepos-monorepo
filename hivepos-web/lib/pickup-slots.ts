// Default weekly pickup schedule. Pre-seeded on every new branch so the public
// pickup form (/pickup/[slug]) works out of the box, and reused as the onboarding
// wizard's pickup-step default. Mirrors the demo seed schedule.
export const DEFAULT_PICKUP_SLOTS = [
  { day: "MON", slots: ["09:00-11:00", "13:00-15:00", "17:00-19:00"] },
  { day: "TUE", slots: ["09:00-11:00", "13:00-15:00", "17:00-19:00"] },
  { day: "WED", slots: ["09:00-11:00", "13:00-15:00", "17:00-19:00"] },
  { day: "THU", slots: ["09:00-11:00", "13:00-15:00", "17:00-19:00"] },
  { day: "FRI", slots: ["09:00-11:00", "13:00-15:00", "17:00-19:00"] },
  { day: "SAT", slots: ["09:00-11:00", "13:00-15:00"] },
] as const;
