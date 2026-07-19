"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { useEffect } from "react";
import { reportClientError } from "@/lib/telemetry/client-errors";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Persist to ErrorLog via /api/telemetry so the crash is visible to super-admin.
    reportClientError(error);
    console.error("App error:", error.digest, error.message);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border/40 shadow-xl">
        <CardHeader className="text-center pb-2 pt-8">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Terjadi Kesalahan</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Maaf, ada yang salah. Silakan coba lagi.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 pb-8">
          <Button onClick={reset} className="w-full">
            <RotateCcw className="mr-2 h-4 w-4" />
            Coba Lagi
          </Button>
          <Button variant="outline" nativeButton={false} render={<a href="/dashboard" />} className="w-full">
            Kembali ke Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
