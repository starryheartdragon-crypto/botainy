# AI Chatbot/RP Web Application - Environment Configuration

Copy this file to `.env.local` and fill in your actual credentials:

```bash
cp .env.example .env.local
```

## Required Credentials

### Supabase
1. Create a project at https://supabase.com
2. Get your URL and Keys from Project Settings > API
3. Copy the public (anon) key and service role key

### OpenRouter  
1. Sign up at https://openrouter.ai
2. Generate an API key in your account settings
3. Add it to OPENROUTER_API_KEY

## Database Setup

After setting up Supabase, run these SQL commands to create tables:

```sql
-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT auth.uid(),
  email TEXT UNIQUE,
  username TEXT UNIQUE,
  birthday DATE,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Bots table
CREATE TABLE bots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES users(id),
  name TEXT NOT NULL,
  description TEXT,
  personality TEXT NOT NULL,
  avatar_url TEXT,
  is_published BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Personas table
CREATE TABLE personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  name TEXT NOT NULL,
  description TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Chats table
CREATE TABLE chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  bot_id UUID REFERENCES bots(id),
  persona_id UUID REFERENCES personas(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Chat messages table
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID REFERENCES chats(id),
  sender_id UUID REFERENCES users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Chat rooms table (public/admin-created rooms)
CREATE TABLE chat_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  background_url TEXT,
  city_info TEXT,
  notable_bots TEXT,
  universe TEXT,
  era TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```
