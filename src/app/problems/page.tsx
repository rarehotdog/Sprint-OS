import { Suspense } from "react";

import ProblemsPageClient from "@/app/problems/problems-page-client";

export const dynamic = "force-dynamic";

export default function ProblemsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background text-foreground">
          <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-6 py-10 text-zinc-300">
            problems workbench를 준비하는 중입니다.
          </main>
        </div>
      }
    >
      <ProblemsPageClient />
    </Suspense>
  );
}
