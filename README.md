# 穿搭评分实验室

一个可直接扩展的 `Next.js` MVP：用户上传照片，服务端调用视觉模型，直接返回穿搭评分和建议。

## 当前能力

- 本地上传图片预览
- 前端直接传图到后端
- 服务端调用 OpenAI 兼容视觉模型
- 结构化返回评分和解释型建议
- 单个 API 路由 `POST /api/analyze`

## 当前接入方式

后端按 OpenAI 兼容协议请求视觉模型，适配豆包方舟这类接口，也能换成别的兼容服务。

环境变量示例：

```bash
cp .env.example .env.local
```

填写：

```bash
VISION_API_BASE_URL=https://operator.las.cn-beijing.volces.com/api/v1
VISION_API_KEY=你的密钥
VISION_MODEL=doubao-1.5-vision-pro
```

## 本地启动

```bash
npm install
npm run dev
```

打开 `http://localhost:3000`。

## 请求格式

前端把图片转成 `data URL` 发给后端，后端再转发给视觉模型。

当前为了避免请求体过大，前端限制图片不超过 `4MB`。如果你后面要上生产，建议把流程改成：

1. 图片先传对象存储。
2. API 把公网 URL 发给视觉模型。
3. 避免大图 base64 带来的带宽和 body 限制。

## 注意事项

- 当前版本依赖你自己配置的视觉模型接口。
- 我把协议做成了通用 OpenAI 兼容格式，不锁死豆包。
- 如果模型输出不是严格 JSON，服务端会做一次兜底解析。
- 建议避免评价身材、颜值、肤色等敏感属性，只评价服装搭配本身。
