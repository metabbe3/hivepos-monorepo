export default function TrackLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="pub-scope min-h-screen antialiased">
      {children}
    </div>
  );
}
