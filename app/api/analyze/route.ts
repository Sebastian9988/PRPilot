import { NextResponse } from "next/server";
import OpenAI from "openai";

const MAX_DIFF_CHARS = 40_000;

const REVIEW_INSTRUCTIONS = `You are PRPilot, a concise senior engineer reviewing a pull request diff.

Analyze the git diff and return Markdown only.
Use exactly these headings, in this exact order:

## 📝 Short Summary
## ⚠️ Potential Risks
## ✅ QA Checklist
## 🔍 Missing Edge Cases
## 💬 Suggested Reviewer Comment

Rules:
- Keep the review specific to the diff and concise.
- Always use those exact headings.
- Use bullet points under every section except Suggested Reviewer Comment.
- Avoid long paragraphs.
- Short Summary: max 3 bullets.
- Potential Risks: max 5 bullets.
- QA Checklist: max 6 bullets.
- Missing Edge Cases: max 4 bullets.
- Suggested Reviewer Comment: max 3 sentences.
- Use short bullet points.
- Avoid repeating the same idea across sections.
- If something is uncertain, say so plainly.
- If you do not see an obvious item for a section, say "None noted."`;

type AnalyzeRequestBody = {
  diff?: unknown;
};

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: AnalyzeRequestBody | null = null;

  try {
    body = (await request.json()) as AnalyzeRequestBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body. Send a payload like { diff: \"...\" }." },
      { status: 400 },
    );
  }

  const diff = typeof body?.diff === "string" ? body.diff.trim() : "";

  if (!diff) {
    return NextResponse.json(
      { error: "The diff is required and must be a non-empty string." },
      { status: 400 },
    );
  }

  if (diff.length > MAX_DIFF_CHARS) {
    return NextResponse.json(
      {
        error: `This diff is too large for the MVP limit. Please keep it under ${MAX_DIFF_CHARS.toLocaleString()} characters.`,
      },
      { status: 413 },
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing OPENAI_API_KEY on the server." },
      { status: 500 },
    );
  }

  try {
    const client = new OpenAI({ apiKey });
    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      temperature: 0.2,
      max_output_tokens: 700,
      store: false,
      instructions: REVIEW_INSTRUCTIONS,
      input: `Review this git diff:\n\n${diff}`,
    });

    const result = response.output_text?.trim();

    if (!result) {
      return NextResponse.json(
        { error: "The model did not return any review text." },
        { status: 502 },
      );
    }

    return NextResponse.json({ result });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "OpenAI request failed. Please try again.",
      },
      { status: 500 },
    );
  }
}
