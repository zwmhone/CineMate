# CineMate

CineMate is a personalised movie recommendation web application built with Next.js, React, Supabase, and the TMDb API. Users can browse movies, search titles, view movie details, manage favourites and watch status, rate and comment on movies, create collections, and receive content-based recommendations.

## Features

- User authentication with Supabase Auth
- Email/password and Google login support
- Movie browsing and search using TMDb
- Movie detail pages with poster, overview, rating, runtime, cast, and similar movies
- Favourites, wishlist, watching, and watched states
- 1-5 star user ratings
- Movie comments and replies
- Comment likes/dislikes and reporting
- Public/private user collections
- Collection comments, replies, reactions, and reports
- User profile editing
- Email update/profile email support
- Dashboard statistics
- Content-based recommendations
- Admin moderation tools
- Three-strike warning and ban flow
- Light and dark theme support
- Responsive layout for desktop and mobile

## Tech Stack

- Next.js
- React
- Supabase Auth
- Supabase PostgreSQL
- TMDb API
- JavaScript
- CSS

## Project Structure

```
public/                 Static assets
src/
  app/                  Next.js app routes
  components/           UI components
  constants/            Fixed app values
  hooks/                Reusable React hooks
  lib/                  Supabase, TMDb, profile, recommendation, and business logic
  utils/                Helper functions
.env.example            Environment variable template
.gitignore              Git ignored files
jsconfig.json           Path alias configuration
package.json            Project scripts and dependencies
README_DEPLOYMENT.md    Deployment notes
```

## Environment Variables

Create a `.env.local` file in the project root for local development.

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_TMDB_API_KEY=your_tmdb_api_key
NEXT_PUBLIC_TMDB_IMAGE_BASE_URL=https://image.tmdb.org/t/p
```

Do not commit `.env.local` to GitHub.

## Local Setup

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open the app:

```text
http://localhost:3000
```

Build the project:

```bash
npm run build
```

Start the production build locally:

```bash
npm start
```

## Supabase Setup

Before using the deployed app, make sure the required Supabase tables, policies, and storage/settings have already been applied in your Supabase project.

The running Next.js app does not need the local `database/` folder if your Supabase database has already been set up.

## Deployment Notes

This project is ready to deploy to platforms such as Vercel or Netlify.

Before deploying, add these environment variables in the deployment platform settings:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_TMDB_API_KEY=your_tmdb_api_key
NEXT_PUBLIC_TMDB_IMAGE_BASE_URL=https://image.tmdb.org/t/p
```
