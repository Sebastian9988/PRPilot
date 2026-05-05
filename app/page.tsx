"use client";

import { FormEvent, useState } from "react";

const MAX_DIFF_CHARS = 40_000;
const REVIEW_SECTIONS = [
  {
    heading: "## 📝 Short Summary",
    title: "📝 Short Summary",
  },
  {
    heading: "## ⚠️ Potential Risks",
    title: "⚠️ Potential Risks",
  },
  {
    heading: "## ✅ QA Checklist",
    title: "✅ QA Checklist",
  },
  {
    heading: "## 🔍 Missing Edge Cases",
    title: "🔍 Missing Edge Cases",
  },
  {
    heading: "## 💬 Suggested Reviewer Comment",
    title: "💬 Suggested Reviewer Comment",
  },
] as const;

const diffPlaceholder = `diff --git a/app/page.tsx b/app/page.tsx
index 2a3bc11..f5b7dd8 100644
--- a/app/page.tsx
+++ b/app/page.tsx
@@ -10,7 +10,10 @@ export default function Page() {
-  return <button>Save</button>;
+  const disabled = isSaving || !title.trim();
+  return (
+    <button disabled={disabled}>Save</button>
+  );
 }`;

type AnalyzeResponse = {
  error?: string;
  result?: string;
};

type ParsedReviewSection = {
  heading: (typeof REVIEW_SECTIONS)[number]["heading"];
  title: (typeof REVIEW_SECTIONS)[number]["title"];
  content: string;
};

function parseReviewSections(review: string): ParsedReviewSection[] {
  const lines = review.replace(/\r\n/g, "\n").split("\n");
  const sections: Array<ParsedReviewSection & { lines: string[] }> = [];
  let currentSection: (ParsedReviewSection & { lines: string[] }) | null = null;

  for (const line of lines) {
    const matchedSection = REVIEW_SECTIONS.find(
      (section) => section.heading === line.trim(),
    );

    if (matchedSection) {
      currentSection = {
        ...matchedSection,
        content: "",
        lines: [],
      };
      sections.push(currentSection);
      continue;
    }

    if (currentSection) {
      currentSection.lines.push(line);
    }
  }

  const parsedSections = sections.map(({ heading, title, lines }) => ({
    heading,
    title,
    content: lines.join("\n").trim(),
  }));

  return parsedSections.length === REVIEW_SECTIONS.length ? parsedSections : [];
}

export default function Home() {
  const [diff, setDiff] = useState("");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">(
    "idle",
  );

  const isTooLarge = diff.length > MAX_DIFF_CHARS;
  const isDisabled = isLoading || !diff.trim() || isTooLarge;
  const canClear = !isLoading && Boolean(diff || result || error);
  const parsedSections = result ? parseReviewSections(result) : [];
  const hasSectionCards = parsedSections.length === REVIEW_SECTIONS.length;

  async function handleCopyReview() {
    if (!result) {
      return;
    }

    try {
      await navigator.clipboard.writeText(result);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  }

  function handleClear() {
    setDiff("");
    setResult("");
    setError("");
    setCopyStatus("idle");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setResult("");
    setCopyStatus("idle");

    if (!diff.trim()) {
      setError("Paste a git diff before analyzing.");
      return;
    }

    if (isTooLarge) {
      setError(
        `This diff is too large for the MVP limit. Please keep it under ${MAX_DIFF_CHARS.toLocaleString()} characters.`,
      );
      return;
    }

    try {
      setIsLoading(true);

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ diff }),
      });

      const data = (await response.json()) as AnalyzeResponse;

      if (!response.ok) {
        throw new Error(data.error || "Something went wrong while analyzing the PR.");
      }

      setResult(data.result || "No review was returned.");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Something went wrong while analyzing the PR.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-6 py-10 lg:px-8">
        <section className="max-w-3xl space-y-4">
          <span className="inline-flex rounded-full border border-amber-300 bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-amber-900">
            PRPilot MVP
          </span>
          <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
            Paste a diff, get a fast PR review draft.
          </h1>
          <p className="max-w-2xl text-base leading-7 text-slate-700 sm:text-lg">
            This MVP keeps the flow intentionally small: drop in a git diff, click
            analyze, and get back a concise review with risks, QA checks, edge
            cases, and a reviewer-ready comment.
          </p>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <form
            onSubmit={handleSubmit}
            className="flex h-[34rem] min-h-0 flex-col overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white/85 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur lg:h-[42rem]"
          >
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">PR Diff</h2>
                <p className="text-sm text-slate-600">
                  Paste a unified git diff. The API validates empty and oversized
                  submissions before sending anything to OpenAI.
                </p>
              </div>
              <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                {diff.length.toLocaleString()} / {MAX_DIFF_CHARS.toLocaleString()}
              </div>
            </div>

            <label className="sr-only" htmlFor="diff">
              Git diff
            </label>
            <div className="min-h-0 flex-1 overflow-hidden rounded-[1.5rem] border border-slate-200 bg-slate-50 p-1 transition focus-within:border-sky-400 focus-within:bg-white focus-within:ring-4 focus-within:ring-sky-100">
              <textarea
                id="diff"
                name="diff"
                value={diff}
                onChange={(event) => setDiff(event.target.value)}
                placeholder={diffPlaceholder}
                className="h-full w-full resize-none overflow-y-auto rounded-[1.2rem] bg-transparent px-5 py-4 pr-3 font-mono text-sm leading-6 text-slate-900 outline-none [scrollbar-color:rgba(100,116,139,0.45)_transparent] [scrollbar-gutter:stable] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-3 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border-[3px] [&::-webkit-scrollbar-thumb]:border-transparent [&::-webkit-scrollbar-thumb]:bg-[rgba(100,116,139,0.34)] [&::-webkit-scrollbar-thumb]:bg-clip-padding hover:[&::-webkit-scrollbar-thumb]:bg-[rgba(100,116,139,0.46)]"
              />
            </div>

            <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-slate-600">
                {isTooLarge
                  ? `This diff is over the ${MAX_DIFF_CHARS.toLocaleString()} character limit for the MVP.`
                  : "Aim for one PR-sized diff so the review stays specific and affordable."}
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={handleClear}
                  disabled={!canClear}
                  className="inline-flex min-w-[120px] items-center justify-center rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
                >
                  Clear
                </button>
                <button
                  type="submit"
                  disabled={isDisabled}
                  className="inline-flex min-w-[160px] items-center justify-center rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {isLoading ? "Analyzing..." : "Analyze PR"}
                </button>
              </div>
            </div>
          </form>

          <section className="flex h-[34rem] min-h-0 flex-col overflow-hidden rounded-[2rem] border border-slate-200/80 bg-slate-950 p-6 text-slate-50 shadow-[0_24px_80px_rgba(15,23,42,0.12)] lg:h-[42rem]">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                {result ? (
                  <span className="mb-3 inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                    Generated Review
                  </span>
                ) : null}
                <h2 className="text-xl font-semibold">Review Output</h2>
                <p className="mt-1 text-sm text-slate-300">
                  The response stays in a fixed panel with internal scrolling so
                  longer reviews do not stretch the whole page.
                </p>
              </div>

              {result ? (
                <button
                  type="button"
                  onClick={handleCopyReview}
                  className="inline-flex min-w-[120px] items-center justify-center rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  {copyStatus === "copied"
                    ? "Copied!"
                    : copyStatus === "failed"
                      ? "Copy failed"
                      : "Copy Review"}
                </button>
              ) : null}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto rounded-[1.5rem] bg-white/5 p-1 [scrollbar-color:rgba(226,232,240,0.28)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-3 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border-[3px] [&::-webkit-scrollbar-thumb]:border-transparent [&::-webkit-scrollbar-thumb]:bg-[rgba(226,232,240,0.22)] [&::-webkit-scrollbar-thumb]:bg-clip-padding hover:[&::-webkit-scrollbar-thumb]:bg-[rgba(226,232,240,0.32)]">
              {error ? (
                <div className="rounded-[1.25rem] border border-red-300/40 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-100">
                  {error}
                </div>
              ) : result ? (
                hasSectionCards ? (
                  <div className="flex flex-col gap-3 p-1 pr-2">
                    {parsedSections.map((section) => (
                      <section
                        key={section.heading}
                        className="rounded-[1.25rem] border border-white/10 bg-white/[0.06] px-4 py-4"
                      >
                        <h3 className="text-base font-semibold tracking-tight text-white">
                          {section.title}
                        </h3>
                        <div className="mt-3 whitespace-pre-wrap break-words text-[15px] leading-7 text-slate-100">
                          {section.content || "None noted."}
                        </div>
                      </section>
                    ))}
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap break-words rounded-[1.25rem] px-4 py-4 text-[15px] leading-7 text-slate-100">
                    {result}
                  </div>
                )
              ) : (
                <div className="rounded-[1.25rem] border border-dashed border-white/15 bg-white/5 px-5 py-6 text-sm leading-7 text-slate-300">
                  Your review will appear here after the API finishes analyzing the
                  diff.
                </div>
              )}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
