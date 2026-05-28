# 森岳 AI Agent

私有 AI 网页对话系统，包含账号登录、SQLite 历史记录、流式回复、owner/admin/user 三角色后台，以及 OpenAI 云端或 OpenAI 兼容本地模型切换。

## 本地开发

```bash
npm install
cp .env.example .env
mkdir -p data
npm run prisma:migrate
npm run init-admin
npm run dev
```

打开 `http://localhost:3000`，使用 `.env` 里的 `ADMIN_USERNAME` / `ADMIN_PASSWORD` 登录。这个初始化账号会被创建为 `owner` 所有者。

## 角色权限

- `owner`：拥有全部权限，可管理所有用户、模型设置、聊天预设和提问日志。
- `admin`：只能新增、删除、改密普通用户，不能管理 `admin` 或 `owner`。
- `user`：只能使用聊天功能。

普通用户和管理员聊天时会自动应用后台配置的聊天预设。每次用户提问都会写入行为日志，owner 可在后台查看最近 100 条。

## 环境变量

核心 `.env`：

```env
DATABASE_URL="file:../data/app.db"
AUTH_SECRET="change-this-to-a-random-string-with-at-least-32-characters"
AUTH_COOKIE_SECURE=""
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="change-this-password"
MODEL_PROVIDER="openai"
OPENAI_API_KEY=""
OPENAI_MODEL="gpt-5.5"
LOCAL_OPENAI_BASE_URL=""
LOCAL_OPENAI_API_KEY=""
LOCAL_OPENAI_MODEL="local-model"
```

`DATABASE_URL` 使用 `../data/app.db`，因为 Prisma 会按 `prisma/schema.prisma` 所在目录解析 SQLite 路径。这样本地会写入项目根目录 `data`，Docker 内会写入 `/app/data`。

模型相关环境变量是启动/兜底值。owner 在后台保存的模型配置会写入 SQLite，并优先生效。

## Docker Compose 部署

```bash
cp .env.example .env
nano .env
docker compose up -d --build
docker compose logs -f ai-chat
```

SQLite 数据会持久化到宿主机 `./data`。容器启动时会自动执行 Prisma migration，并根据 `.env` 创建或更新 owner 账号。

公网部署建议放在 Nginx/Caddy HTTPS 后面。临时 HTTP 测试时可以设置 `AUTH_COOKIE_SECURE="false"`，正式 HTTPS 时建议删除该值或设为 `"true"`。

## 模型配置示例

OpenAI 云端：

```env
MODEL_PROVIDER="openai"
OPENAI_API_KEY="sk-..."
OPENAI_MODEL="gpt-5.5"
```

OpenAI 兼容接口：

```env
MODEL_PROVIDER="local_openai"
LOCAL_OPENAI_BASE_URL="http://192.168.1.50:8000/v1"
LOCAL_OPENAI_API_KEY=""
LOCAL_OPENAI_MODEL="your-model-name"
```

本地模型服务必须能被运行本项目的服务器访问。
