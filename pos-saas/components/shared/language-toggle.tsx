"use client";

import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTranslation } from "@/hooks/use-translation";
import type { Lang } from "@/lib/i18n";

const languages: { value: Lang; label: string; flag: string }[] = [
  { value: "en", label: "English", flag: "EN" },
  { value: "id", label: "Bahasa Indonesia", flag: "ID" },
];

export function LanguageToggle() {
  const { lang, setLang } = useTranslation();

  const current = languages.find((l) => l.value === lang) ?? languages[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={
        <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-xs font-medium text-muted-foreground hover:text-foreground" />
      }>
        <Globe className="h-3.5 w-3.5" />
        <span>{current.flag}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[160px]">
        {languages.map((l) => (
          <DropdownMenuItem
            key={l.value}
            onClick={() => setLang(l.value)}
            className={lang === l.value ? "font-semibold bg-accent/50" : ""}
          >
            <span className="mr-2 text-xs font-bold opacity-60">{l.flag}</span>
            {l.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
