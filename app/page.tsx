"use client";

import Image from "next/image";
import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import type { AnalysisResult } from "@/lib/types";

const acceptedFormats = "image/*,.heic,.heif,.HEIC,.HEIF";
const maxFileSize = 4 * 1024 * 1024;

export default function HomePage() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const onFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const nextRawFile = event.target.files?.[0] ?? null;

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    try {
      const nextFile = await normalizeImageFile(nextRawFile);

      if (nextFile && nextFile.size > maxFileSize) {
        setFile(null);
        setPreviewUrl(null);
        setResult(null);
        setError("图片请控制在 4MB 以内，避免直传给视觉模型时超出限制。");
        return;
      }

      setFile(nextFile);
      setResult(null);
      setError(null);
      setPreviewUrl(nextFile ? URL.createObjectURL(nextFile) : null);
    } catch (fileError) {
      setFile(null);
      setPreviewUrl(null);
      setResult(null);
      setError(
        fileError instanceof Error
          ? fileError.message
          : "图片处理失败，请换一张照片再试"
      );
    }
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!file) {
      setError("先上传一张穿搭照片。");
      return;
    }

    setIsSubmitting(true);

    try {
      const imageDataUrl = await readFileAsDataUrl(file);
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          imageName: file.name,
          imageDataUrl
        })
      });

      if (!response.ok) {
        const errorPayload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(errorPayload?.error ?? "分析请求失败");
      }

      const data = (await response.json()) as AnalysisResult;
      setResult(data);
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "服务暂时不可用"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="page-shell">
      <section className="hero-card">
        <p className="eyebrow">Outfit Score MVP</p>
        <h1>上传照片，给她的穿搭打分并给出改进建议</h1>
        <p className="hero-copy">
          当前版本改成了纯图片分析。前端只上传照片，后端会调用视觉模型直接输出评分、
          亮点和改进建议。
        </p>
      </section>

      <section className="workspace">
        <form className="panel form-panel" onSubmit={onSubmit}>
          <div className="upload-block">
            <label className="upload-label" htmlFor="photo">
              <span>穿搭照片</span>
              <input
                id="photo"
                name="photo"
                type="file"
                accept={acceptedFormats}
                onChange={onFileChange}
              />
            </label>
            <p className="hint">
              支持 JPG / JPEG / PNG / WEBP，也支持 iPhone 的 HEIC / HEIF，上传前会自动转成 JPEG。
            </p>
          </div>

          <div className="info-box">
            <h2>评分维度</h2>
            <p>视觉模型会直接判断配色、版型、层次、细节收尾和场景适配度。</p>
            <p>输出内容只评价穿搭，不评价身材、颜值或其他敏感属性。</p>
          </div>

          <button className="primary-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "分析中..." : "开始评分"}
          </button>

          {error ? <p className="error-text">{error}</p> : null}
        </form>

        <aside className="panel result-panel">
          {previewUrl ? (
            <Image
              className="preview-image"
              src={previewUrl}
              alt="用户上传的穿搭预览"
              width={960}
              height={1200}
              unoptimized
            />
          ) : (
            <div className="empty-state">
              <p>上传后在这里预览照片。</p>
            </div>
          )}

          {result ? (
            <ResultCard result={result} />
          ) : (
            <div className="empty-state secondary">
              <p>评分结果会显示在这里。</p>
            </div>
          )}
        </aside>
      </section>
    </main>
  );
}

function ResultCard({ result }: { result: AnalysisResult }) {
  return (
    <div className="result-card">
      <div
        className="score-ring"
        style={{ ["--score" as string]: `${result.overallScore}%` }}
      >
        <strong>{result.overallScore}</strong>
        <span>/100</span>
      </div>

      <div className="result-summary">
        <p className="style-tag">{result.styleLabel}</p>
        <p>{result.summary}</p>
      </div>

      <div className="score-list">
        {result.subscores.map((item) => (
          <div className="score-row" key={item.label}>
            <span>{item.label}</span>
            <strong>{item.score}</strong>
          </div>
        ))}
      </div>

      <section>
        <h2>亮点</h2>
        <ul>
          {result.strengths.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2>建议</h2>
        <ul>
          {result.suggestions.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("图片读取失败"));
    };

    reader.onerror = () => reject(new Error("图片读取失败"));
    reader.readAsDataURL(file);
  });
}

async function normalizeImageFile(file: File | null) {
  if (!file) {
    return null;
  }

  if (!isHeifFile(file)) {
    return file;
  }

  const { default: heic2any } = await import("heic2any");
  const output = await heic2any({
    blob: file,
    toType: "image/jpeg",
    quality: 0.9
  });

  const convertedBlob = Array.isArray(output) ? output[0] : output;

  if (!(convertedBlob instanceof Blob)) {
    throw new Error("HEIC 图片转换失败，请换一张照片再试。");
  }

  const nextName = file.name.replace(/\.(heic|heif)$/i, ".jpg");
  return new File([convertedBlob], nextName, {
    type: "image/jpeg",
    lastModified: Date.now()
  });
}

function isHeifFile(file: File) {
  const mimeType = file.type.toLowerCase();
  return (
    mimeType === "image/heic" ||
    mimeType === "image/heif" ||
    /\.(heic|heif)$/i.test(file.name)
  );
}
