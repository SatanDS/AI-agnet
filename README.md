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

管理员登录后可以从聊天页左侧进入 `Admin` 后台，或直接访问 `/admin`。

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

`.env` 里的模型配置是首次启动和兜底配置。管理员后台保存模型配置后，聊天接口会优先读取数据库里的后台配置，通常不需要重启容器。

## 管理员后台

访问 `/admin` 可以：

- 新增普通用户或管理员用户
- 删除用户，同时删除该用户聊天记录
- 重置用户密码
- 切换用户管理员权限
- 在 OpenAI 云端和 OpenAI 兼容本地模型之间切换
- 保存 OpenAI API key、本地模型地址和模型名

系统会阻止删除当前登录的管理员账号，也会阻止移除最后一个管理员权限。

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
