export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center gap-6 px-6 py-16">
        <p className="text-sm uppercase tracking-[0.2em] text-zinc-400">
          GMAT 805 Training Console
        </p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          GMAT Sprint OS
        </h1>
        <p className="max-w-2xl text-zinc-300">
          TASK 1 baseline is ready. Next slices will implement Pre-Think solve
          flow, Quick/Deep report pipeline, and AI expansion cards.
        </p>
      </main>
    </div>
  );
}
