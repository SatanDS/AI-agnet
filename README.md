# AI Chat Web

一个私有网页 AI 对话系统，支持账号密码登录、SQLite 持久化聊天记录、流式输出，以及通过后端环境变量切换 OpenAI 云端模型或 OpenAI 兼容本地模型。

## 本地运行

当前目录生成的是完整项目源码。先安装 Node.js 22+，然后执行：

```bash
npm install
cp .env.example .env
npm run prisma:migrate
npm run init-admin
npm run dev
```

打开 `http://localhost:3000`，使用 `.env` 里的 `ADMIN_USERNAME` 和 `ADMIN_PASSWORD` 登录。

## 环境变量

核心配置在 `.env`：

```env
DATABASE_URL="file:./data/app.db"
AUTH_SECRET="change-this-to-a-random-string-with-at-least-32-characters"
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="change-this-password"
MODEL_PROVIDER="openai"
OPENAI_API_KEY=""
OPENAI_MODEL="gpt-5.5"
LOCAL_OPENAI_BASE_URL=""
LOCAL_OPENAI_API_KEY=""
LOCAL_OPENAI_MODEL="local-model"
```

使用 OpenAI 云端时：

```env
MODEL_PROVIDER="openai"
OPENAI_API_KEY="sk-..."
OPENAI_MODEL="gpt-5.5"
```

使用另一台电脑上的 OpenAI 兼容本地模型时：

```env
MODEL_PROVIDER="local_openai"
LOCAL_OPENAI_BASE_URL="http://192.168.1.50:8000/v1"
LOCAL_OPENAI_API_KEY=""
LOCAL_OPENAI_MODEL="your-model-name"
```

本地模型服务必须能被部署这套网页后端的机器访问。

## Docker 部署

```bash
cp .env.example .env
docker compose up -d --build
```

SQLite 数据会保存在宿主机的 `./data` 目录。容器启动时会自动运行数据库迁移，并按 `.env` 创建或更新管理员账号。

## API

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/me`
- `GET /api/conversations`
- `POST /api/conversations`
- `DELETE /api/conversations/:id`
- `GET /api/conversations/:id/messages`
- `POST /api/chat`

`POST /api/chat` 返回 `text/event-stream`，每个事件都是 JSON：

```json
{"text":"模型输出片段"}
```

或：

```json
{"meta":{"conversationId":"..."}}
```

完成时：

```json
{"done":true}
```
