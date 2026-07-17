import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border/40 shadow-xl">
        <CardHeader className="text-center pb-2 pt-8">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-muted">
            <span className="text-4xl font-black text-muted-foreground">404</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Halaman Tidak Ditemukan</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Maaf, halaman yang Anda cari tidak ada atau sudah dipindahkan.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 pb-8">
          <Button className="w-full" render={<a href="/dashboard" />}>
            <Home className="mr-2 h-4 w-4" />
            Kembali ke Dashboard
          </Button>
          <Button variant="outline" className="w-full" render={<a href="/" />}>
            Ke Halaman Utama
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
