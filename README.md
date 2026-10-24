# CampusLearn

CampusLearn is a student-first academic platform for engineering learners, teaching staff, coordinators, and administrators. It combines study resources, user dashboards, role-based management, and an AI-powered study companion in one experience.

The AI buddy is called Gooloogulu — a friendly, cute academic assistant with a soft mascot vibe and a tiny goggles look to make it feel approachable and study-friendly.

## ✨ What the app includes

- Student dashboard with enrollment, subject access, academic progress, and CGPA tracking
- Subject pages with notes, question papers, books, assignments, and study materials
- Role-based panels for students, teachers, coordinators, and admins
- AI study buddy for revision, concept explanations, flashcards, and quick guidance
- File attachment support for PDFs, TXT, CSV, and markdown notes
- Dark mode, responsive UI, and a polished mobile-friendly interface
- Supabase-powered authentication and database workflows

## 🧠 AI agent / study buddy

CampusLearn includes a floating AI assistant named Gooloogulu that can:

- answer academic questions in a student-friendly tone
- explain topics step by step
- create quizzes, flashcards, and study plans
- use attached notes and PDFs as context
- export chat history for later use

The assistant is built around the app's AI utility flow and is designed to work as a supportive study partner rather than a generic chatbot.

The mascot branding uses a cheerful, cute look with goggles-inspired styling, making the assistant feel more like a "study buddy" than a cold technical tool.

## 🛠️ Tech stack

- React + Vite
- Tailwind CSS
- Supabase for auth and database
- LangChain + Groq for AI responses
- Framer Motion for smooth UI interactions
- PDF parsing for attached lesson notes

## 📁 Project structure

- `src/` — frontend application source code
- `src/components/AIBuddy.jsx` — floating AI chat assistant UI and logic
- `src/util/ai.js` — AI request logic
- `supabase/` — Supabase config and edge function logic
- `supabase_schema.sql` and related SQL files — database setup scripts
- `scripts/` — admin/data migration and upload scripts
- `tests/` — app validation tests
- `OPERATIONS.md` — release and deployment guidance

## ✅ Prerequisites

Make sure you have:

- Node.js 18+
- npm
- A Supabase project
- A Groq API key for the AI assistant

## ⚙️ Environment setup

Create a local environment file from your project settings and add the required values:

```bash
copy .env.example .env
```

Then fill in:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

Important:

- `SUPABASE_SERVICE_ROLE_KEY` is server-side only
- never expose private keys in browser-facing frontend code
- keep the Groq API key in your backend environment or Supabase secret configuration, not in the browser

## 🤖 AI assistant setup

The AI buddy uses the Supabase edge function and Groq model integration. Set the provider key as a Supabase secret and deploy the function:

```bash
supabase secrets set GROQ_API_KEY=your-groq-api-key
supabase functions deploy ai-chat
```

The app is designed to call the backend AI flow and stream the response through the floating chat widget.

## 🗄️ Database setup

Before starting the app, import the schema files in your Supabase SQL editor. Recommended flow:

1. Import `supabase_schema.sql` or `complete_campuslearn_setup.sql`
2. Apply any migration/fix scripts needed for your environment
3. Verify tables, auth policies, and role setup are active

## 🚀 Local development

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Build the production bundle:

```bash
npm run build
```

Run the app preview locally:

```bash
npm run preview
```

Run the project tests:

```bash
npm test
```

Run lint checks:

```bash
npm run lint
```

## 📘 Launch operations

Read [OPERATIONS.md](./OPERATIONS.md) before production use. It contains the release checklist, environment verification steps, role checks, backup guidance, and operational notes.

## 🧩 Notes

This project depends on a configured Supabase backend, valid credentials, and the correct database schema. Without those, the app and AI agent will not work fully.

## 🐻 Mascot branding note

Gooloogulu is designed to feel warm, playful, and motivating for students. The goggles-inspired look keeps the assistant cute, memorable, and confidently academic without feeling intimidating.

## License

This project is intended for academic/prototype use and internal deployment workflows.
