import type { AnalysisResult, AnalyzePhotoRequest } from "@/lib/types";

type OpenAICompatibleResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

const defaultPrompt = [
  "你是一个专业但克制的女装穿搭分析师。",
  "任务：只根据用户上传的穿搭照片，输出严格 JSON。",
  "要求：",
  "1. 只评价穿搭本身，不评价身材、颜值、年龄、肤色、种族或其他敏感属性。",
  "2. 分析配色、版型比例、层次感、细节收尾、场景适配度。",
  "3. overallScore 为 0-100 的整数。",
  "4. styleLabel 是 2-8 个中文字符的风格标签。",
  "5. summary 是 1-2 句中文总结。",
  "6. subscores 必须包含 5 项，label 分别为：配色、版型比例、场景匹配、层次感、细节收尾；score 格式必须像 24/30。",
  "7. strengths 返回 2-3 条具体亮点。",
  "8. suggestions 返回 3-4 条具体可执行建议。",
  "9. 如果图片不够清晰或不是有效穿搭照，也必须返回 JSON，并在 summary 与 suggestions 中说明判断受限。",
  "输出 JSON Schema：",
  '{"overallScore":82,"styleLabel":"简约通勤风","summary":"...","subscores":[{"label":"配色","score":"24/30"},{"label":"版型比例","score":"16/20"},{"label":"场景匹配","score":"13/15"},{"label":"层次感","score":"12/15"},{"label":"细节收尾","score":"11/15"}],"strengths":["..."],"suggestions":["..."]}'
].join("\n");

function getEnv(name: string) {
  const value = process.env[name];
  return value?.trim() ? value.trim() : null;
}

function getEndpoint() {
  const baseUrl = getEnv("VISION_API_BASE_URL");
  if (!baseUrl) {
    throw new Error("缺少 VISION_API_BASE_URL，先在 .env.local 里配置视觉模型接口。");
  }

  return baseUrl.endsWith("/chat/completions")
    ? baseUrl
    : `${baseUrl.replace(/\/$/, "")}/chat/completions`;
}

function extractJson(text: string) {
  const fencedMatch = text.match(/```json\s*([\s\S]*?)```/i);
  const candidate = fencedMatch?.[1] ?? text;
  const firstBrace = candidate.indexOf("{");
  const lastBrace = candidate.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("模型返回里没有可解析的 JSON。");
  }

  return candidate.slice(firstBrace, lastBrace + 1);
}

function normalizeResult(raw: unknown): AnalysisResult {
  const fallback: AnalysisResult = {
    overallScore: 70,
    styleLabel: "日常风",
    summary: "模型已返回结果，但结构不完整，当前使用了兜底格式。",
    subscores: [
      { label: "配色", score: "20/30" },
      { label: "版型比例", score: "14/20" },
      { label: "场景匹配", score: "11/15" },
      { label: "层次感", score: "11/15" },
      { label: "细节收尾", score: "10/15" }
    ],
    strengths: ["整体方向基本成立。"],
    suggestions: ["建议优化提示词，约束模型严格输出指定 JSON。"]
  };

  if (!raw || typeof raw !== "object") {
    return fallback;
  }

  const candidate = raw as Partial<AnalysisResult>;

  return {
    overallScore:
      typeof candidate.overallScore === "number"
        ? Math.max(0, Math.min(100, Math.round(candidate.overallScore)))
        : fallback.overallScore,
    styleLabel:
      typeof candidate.styleLabel === "string" && candidate.styleLabel.trim()
        ? candidate.styleLabel.trim()
        : fallback.styleLabel,
    summary:
      typeof candidate.summary === "string" && candidate.summary.trim()
        ? candidate.summary.trim()
        : fallback.summary,
    subscores:
      Array.isArray(candidate.subscores) && candidate.subscores.length > 0
        ? candidate.subscores
            .map((item) => {
              if (!item || typeof item !== "object") {
                return null;
              }

              const row = item as { label?: unknown; score?: unknown };
              if (typeof row.label !== "string" || typeof row.score !== "string") {
                return null;
              }

              return {
                label: row.label,
                score: row.score
              };
            })
            .filter((item): item is { label: string; score: string } => Boolean(item))
        : fallback.subscores,
    strengths:
      Array.isArray(candidate.strengths) && candidate.strengths.length > 0
        ? candidate.strengths.filter(
            (item): item is string => typeof item === "string" && item.trim().length > 0
          )
        : fallback.strengths,
    suggestions:
      Array.isArray(candidate.suggestions) && candidate.suggestions.length > 0
        ? candidate.suggestions.filter(
            (item): item is string => typeof item === "string" && item.trim().length > 0
          )
        : fallback.suggestions
  };
}

export async function analyzeOutfitPhoto(
  input: AnalyzePhotoRequest
): Promise<AnalysisResult> {
  const apiKey = getEnv("VISION_API_KEY");
  const model = getEnv("VISION_MODEL");

  if (!apiKey || !model) {
    throw new Error("缺少 VISION_API_KEY 或 VISION_MODEL，先把视觉模型环境变量配好。");
  }

  const response = await fetch(getEndpoint(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: defaultPrompt
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `请分析这张穿搭照片。原始文件名：${input.imageName}`
            },
            {
              type: "image_url",
              image_url: {
                url: input.imageDataUrl
              }
            }
          ]
        }
      ]
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`视觉模型请求失败：${response.status} ${detail.slice(0, 200)}`);
  }

  const data = (await response.json()) as OpenAICompatibleResponse;
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("视觉模型没有返回可用内容。");
  }

  const parsed = JSON.parse(extractJson(content));
  return normalizeResult(parsed);
}
