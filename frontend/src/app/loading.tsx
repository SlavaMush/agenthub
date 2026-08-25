export default function Loading() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="h-10 w-48 rounded-full bg-white/5" />
      <div className="h-24 w-3/4 rounded-2xl bg-white/5" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-white/5" />
        ))}
      </div>
    </div>
  );
}
