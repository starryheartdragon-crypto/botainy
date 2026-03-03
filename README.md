# AI Chatbot/RP Web Application

An 18+ interactive web application for creating and chatting with AI-powered character bots. Users create custom bots based on favorite characters and OCs, then engage in immersive roleplay conversations with customizable personas.

## Features

### Bot Creation & Management
- Create custom AI bots with unique personalities
- Define bot characteristics, background, and speaking style
- Publish bots publicly or keep them private on your profile
- Browse and interact with community bots

### Chat System
- **One-on-One Chats**: Direct conversations with individual bots
- **Group Chats**: Chat with multiple bots simultaneously
- **Chat Rooms**: Community spaces where users can invite bots via voting
- Real-time messaging powered by Supabase

### Personas
- Create multiple user personas (masks/characters)
- Switch between personas when chatting with different bots
- Customize persona appearance and personality

### User Profiles
- Fully customizable user profiles
- Music player with up to 12 songs
- Display created bots and personas
- Share profile with the community

## Tech Stack

- **Frontend**: [Next.js](https://nextjs.org/) with React
- **Language**: TypeScript
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Backend**: Next.js API Routes
- **Database**: [Supabase](https://supabase.com/) (PostgreSQL)
- **LLM API**: [OpenRouter](https://openrouter.ai/)
- **Authentication**: Supabase Auth
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **Notifications**: [React Hot Toast](https://react-hot-toast.com/)

## Getting Started

### Prerequisites

- Node.js 18.17 or later
- npm or yarn
- Supabase account
- OpenRouter API key

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd ai-chatbot-rp-app
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

4. Fill in your credentials in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
OPENROUTER_API_KEY=your_openrouter_api_key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Setting Up Supabase

1. Create a Supabase project at https://supabase.com
2. Run the SQL scripts from [SETUP.md](./SETUP.md) in your Supabase SQL editor
3. Copy your Project URL and API keys to `.env.local`

### Development

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── components/            # Reusable React components
│   ├── Auth.tsx          # Authentication component
│   └── ToastProvider.tsx  # Toast notifications
├── lib/                   # Utility functions and APIs
│   ├── supabase.ts       # Supabase client setup
│   └── openrouter.ts     # OpenRouter API client
├── store/                # Zustand state stores
│   ├── authStore.ts      # Authentication state
│   └── chatStore.ts      # Chat state
└── types/                # TypeScript type definitions
    └── index.ts          # Shared types
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npm run smoke` - Run authenticated API smoke checks (chat creation + messaging)

## Smoke Testing

The smoke suite runs a minimal authenticated flow:

1. List chats (`GET /api/chats`)
2. Create/reuse a chat (`POST /api/chats`)
3. Send a message (`POST /api/chats/[chatId]/messages`)
4. Verify messages load (`GET /api/chats/[chatId]/messages`)

Required environment variables:

```bash
SMOKE_AUTH_TOKEN=your_supabase_access_token
SMOKE_BOT_ID=existing_bot_uuid
```

Optional variables:

```bash
SMOKE_BASE_URL=http://localhost:3000
SMOKE_PERSONA_ID=existing_persona_uuid
```

Run the app, then run:

```bash
npm run smoke
```

## Environment Variables

See `.env.example` for all available environment variables.

## Documentation

- [Database Setup Guide](./SETUP.md)
- [Copilot Instructions](./.github/copilot-instructions.md)

## Roadmap

- [ ] User authentication system
- [ ] Bot creation interface
- [ ] Chat messaging system
- [ ] Persona management
- [ ] Profile customization
- [ ] Music player integration
- [ ] Real-time notifications
- [ ] Bot publishing system
- [ ] Chat rooms
- [ ] Community features

## Content Warning

⚠️ **This application is for 18+ users only.** It allows creation and interaction with mature-themed content. Users must be of legal age in their jurisdiction to use this platform.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is private and confidential.
"# botainy" 
