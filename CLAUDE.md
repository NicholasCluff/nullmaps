# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a SvelteKit application using Svelte 5, TypeScript, and Tailwind CSS. The project is configured for deployment on Vercel and uses Playwright for end-to-end testing.
The core app is a mobile first webmap for the tasmanian LIST services. It is designed to provide a user with the ability to view LISTmap data from
https://services.thelist.tas.gov.au/arcgis/rest/services in a convienient and user friendly manner with industry standard UX. It uses maplibre as the core mapping library.

## Development Commands

### Core Development

- `npm run dev` - Start development server
- `npm run dev -- --open` - Start dev server and open in browser
- `npm run build` - Build for production
- `npm run preview` - Preview production build

### Code Quality

- `npm run check` - Run Svelte type checking
- `npm run check:watch` - Run Svelte type checking in watch mode
- `npm run lint` - Run linting (Prettier + ESLint)
- `npm run format` - Format code with Prettier

### Testing

- `npm run test` - Run all tests (currently just e2e)
- `npm run test:e2e` - Run Playwright end-to-end tests

## Architecture

### Tech Stack

- **Framework**: SvelteKit with Svelte 5
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4 with plugins (@tailwindcss/forms, @tailwindcss/typography)
- **Testing**: Playwright for e2e tests
- **Deployment**: Vercel (using @sveltejs/adapter-vercel)
- **Build Tool**: Vite

### Project Structure

- `src/routes/` - SvelteKit file-based routing
  - `+layout.svelte` - Root layout component
  - `+page.svelte` - Home page component
- `src/lib/` - Shared library code and assets
- `src/app.css` - Global styles
- `e2e/` - Playwright end-to-end tests
- `static/` - Static assets served from root

### Key Configuration Files

- `svelte.config.js` - SvelteKit configuration with Vercel adapter
- `playwright.config.ts` - Playwright test configuration
- `eslint.config.js` - ESLint configuration using new flat config format
- `tsconfig.json` - TypeScript configuration
- `vite.config.ts` - Vite build configuration

## Development Notes

The project uses Svelte 5 with the new `$props()` rune syntax. The codebase is minimal and follows standard SvelteKit conventions for file-based routing and component structure.
