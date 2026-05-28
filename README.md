# AI Chat Web

Private AI chat web app with password login, SQLite conversation history,
streaming responses, an admin console, and provider switching between OpenAI
cloud models and OpenAI-compatible local models.

## Local Development

Install Node.js 22+, then run:

```bash
npm install
cp .env.example .env
mkdir -p data
npm run prisma:migrate
npm run init-admin
npm run dev
```

Open `http://localhost:3000` and sign in with `ADMIN_USERNAME` /
`ADMIN_PASSWORD` from `.env`.

Admins can open `/admin` from the chat sidebar.

## Environment

Core `.env` values:

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

`DATABASE_URL` uses `../data/app.db` because Prisma resolves SQLite paths
relative to `prisma/schema.prisma`. This points the database to the project
root `data` directory and to `/app/data` inside Docker.

Model values in `.env` are startup/fallback defaults. Settings saved in the
Admin Console are stored in SQLite and take priority without a container
restart.

## Admin Console

`/admin` supports:

- Create normal users or admin users
- Delete users and their chats
- Reset user passwords
- Grant or remove admin access
- Switch between OpenAI cloud and local OpenAI-compatible providers
- Save API keys, local model URL, and model names

The app prevents deleting your own account, removing admin access from your own
account, and removing the last admin.

## Docker Compose

```bash
cp .env.example .env
docker compose up -d --build
```

SQLite data is persisted in the host `./data` directory. On startup, the
container runs Prisma migrations and creates or updates the admin account from
`.env`.

For public deployment, put the app behind HTTPS with Nginx or Caddy.
If you temporarily test Docker over plain HTTP, set `AUTH_COOKIE_SECURE="false"`
in `.env`; switch it back or remove it when using HTTPS.

## Model Examples

OpenAI cloud:

```env
MODEL_PROVIDER="openai"
OPENAI_API_KEY="sk-..."
OPENAI_MODEL="gpt-5.5"
```

Local OpenAI-compatible model:

```env
MODEL_PROVIDER="local_openai"
LOCAL_OPENAI_BASE_URL="http://192.168.1.50:8000/v1"
LOCAL_OPENAI_API_KEY=""
LOCAL_OPENAI_MODEL="your-model-name"
```

The local model service must be reachable from the machine running this app.
