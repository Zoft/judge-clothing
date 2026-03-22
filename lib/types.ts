export type AnalyzePhotoRequest = {
  imageName: string;
  imageDataUrl: string;
};

export type AnalysisResult = {
  overallScore: number;
  styleLabel: string;
  summary: string;
  subscores: Array<{
    label: string;
    score: string;
  }>;
  strengths: string[];
  suggestions: string[];
};
