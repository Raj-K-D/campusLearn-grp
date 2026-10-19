# CampusLearn

CampusLearn is a modern academic platform designed for engineering students, teachers, coordinators, and administrators. It brings study resources, student dashboards, role-based access, AI assistance, and academic management tools into a single web app.

## Features

- Student dashboard with courses, resources, quizzes, and CGPA tracking
- Subject-wise notes, videos, question papers, and learning materials
- Role-based access for students, teachers, coordinators, and admins
- AI-powered academic assistant for quick help and guidance
- Admin and coordinator tools for enrollment, approvals, and academic workflows
- Dark mode and responsive design for desktop and mobile use
- Supabase email-based password recovery

## Tech Stack

- React + Vite
- Tailwind CSS
- Supabase for auth and database
- LangChain + Groq (`openai/gpt-oss-120b`) for AI assistant features
- Framer Motion for UI interactions

## Project Structure

- `src/` - application source code
- `public/` - static assets
- `supabase_schema.sql` and related SQL files - database schema and setup scripts
- `complete_campuslearn_setup.sql` - full setup script for Supabase
- `.env.example` - environment configuration template

## Prerequisites

Before running the app, make sure you have:

- Node.js 18+
- npm
- A Supabase project
- A Groq API key

## Environment Setup

1. Copy the example environment file:

   ```bash
   copy .env.example .env
   ```

2. Fill in the values in `.env`:

   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
   ```

   `SUPABASE_SERVICE_ROLE_KEY` is for trusted server-side scripts only. Never prefix private keys with `VITE_` or expose them in browser code.

## AI Assistant Setup

Mini Agent uses LangChain with Groq's `openai/gpt-oss-120b` model in the `ai-chat` Supabase Edge Function. Configure the provider key as a Supabase secret; do not put it in the frontend `.env` file:

```bash
supabase secrets set GROQ_API_KEY=your-groq-api-key
supabase functions deploy ai-chat
```

## Database Setup

Run the Supabase SQL scripts in your Supabase SQL editor before starting the app.

Recommended flow:

1. Import the schema from `supabase_schema.sql` or `complete_campuslearn_setup.sql`
2. Apply any additional migration or fix scripts if required by your environment
3. Confirm that the necessary tables, policies, and auth users are available

## Local Development

Install dependencies:

```bash
npm ci
```

Start the dev server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

Run the automated unit tests:

```bash
npm test
```

## Launch operations

Read [OPERATIONS.md](./OPERATIONS.md) before staging or production. It covers the release checklist, role-based acceptance tests, password recovery redirect configuration, backup/restore verification, and known launch blockers. This repository does not configure hosting, monitoring, backups, or a production support contact.

## Linting

```bash
npm run lint
```

## Notes

This project is intended to be used with a configured Supabase backend and valid API credentials. Without the required environment variables, the `GROQ_API_KEY` Supabase secret, and database schema, the app will not function correctly.

## License

This project is currently for internal academic/prototype use.
