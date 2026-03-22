import { NextResponse } from "next/server";
import { analyzeOutfitPhoto } from "@/lib/vision-client";
import type { AnalyzePhotoRequest } from "@/lib/types";

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<AnalyzePhotoRequest>;

  const requiredFields: Array<keyof AnalyzePhotoRequest> = [
    "imageName",
    "imageDataUrl"
  ];

  const missingField = requiredFields.find((field) => typeof body[field] !== "string");

  if (missingField) {
    return NextResponse.json(
      { error: `Missing field: ${missingField}` },
      { status: 400 }
    );
  }

  try {
    const result = await analyzeOutfitPhoto(body as AnalyzePhotoRequest);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "视觉模型调用失败，请稍后再试";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
