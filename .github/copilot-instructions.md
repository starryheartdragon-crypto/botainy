# AI Chatbot/RP Web Application

## Project Overview
An 18+ full-stack web application for creating and interacting with AI-powered character bots. Users can create bots based on favorite characters and original characters (OCs), then chat and roleplay through customizable personas.

## Key Features
- **Bot Creation & Management**: Users create character bots with customizable personalities
- **Chat System**: One-on-one chats, group chats, and public chat rooms
- **Personas**: User-specific masks/characters to interact with different bots
- **User Profiles**: Fully customizable with music player (up to 12 songs)
- **Publishing System**: Bots can be public or private to user profile
- **Real-time Chat**: Powered by Supabase real-time features
- **AI Integration**: OpenRouter API for LLM capabilities

## Tech Stack
- **Frontend**: React with Next.js (App Router)
- **Language**: TypeScript
- **Backend**: Next.js API Routes + Supabase
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **LLM**: OpenRouter
- **Authentication**: Supabase Auth
- **Real-time**: Supabase RealtimeSubscriptions

## Development Setup

### Prerequisites
- Node.js 18+ installed
- npm package manager
- Supabase account
- OpenRouter API key

### Environment Variables
Create a `.env.local` file:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
OPENROUTER_API_KEY=your_openrouter_api_key
```

### Running Development Server
```bash
npm run dev
```
Open http://localhost:3000
