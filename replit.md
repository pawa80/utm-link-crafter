# UTM Link Builder Application

## Overview

This is a full-stack web application for creating and managing UTM (Urchin Tracking Module) links. The application helps digital marketers create, organize, and track campaign links with customizable parameters and source templates.

## System Architecture

The application follows a modern full-stack architecture with clear separation between client and server:

- **Frontend**: React with TypeScript, using Vite for bundling and development
- **Backend**: Express.js server with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Firebase Authentication
- **UI Framework**: shadcn/ui components with Tailwind CSS
- **Development**: Replit environment with hot reload

## Key Components

### Frontend Architecture
- **React Router**: Using Wouter for client-side routing
- **State Management**: React Query (TanStack Query) for server state management
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom CSS variables for theming
- **Form Handling**: React Hook Form with Zod validation

### Backend Architecture
- **Express Server**: RESTful API with TypeScript
- **Database Layer**: Drizzle ORM with PostgreSQL
- **Authentication Middleware**: Firebase UID-based authentication
- **Data Storage**: Abstracted storage interface for flexibility

### Database Schema
- **Users Table**: Stores user preferences, custom fields, and configuration
- **UTM Links Table**: Stores generated UTM links with metadata
- **Source Templates Table**: Stores reusable source configurations with mediums and formats

## Data Flow

1. **Authentication Flow**:
   - User authenticates via Firebase
   - Firebase UID is sent to backend for user creation/retrieval
   - JWT tokens are managed client-side

2. **UTM Link Generation**:
   - User inputs campaign parameters
   - Frontend validates and generates UTM URLs
   - Links are saved to database with metadata
   - Generated links can be copied or exported

3. **Template Management**:
   - Users can create source templates with predefined mediums
   - Templates support A/B testing configurations
   - Templates are reusable across campaigns

## External Dependencies

### Frontend Dependencies
- React ecosystem (React, React DOM, React Query)
- UI components (Radix UI primitives, shadcn/ui)
- Utilities (clsx, class-variance-authority, date-fns)
- Firebase SDK for authentication
- Tailwind CSS for styling

### Backend Dependencies
- Express.js for server framework
- Drizzle ORM with PostgreSQL driver (@neondatabase/serverless)
- Authentication and session management
- Database migrations and schema management

### Development Dependencies
- Vite for frontend build tooling
- TypeScript for type safety
- ESBuild for backend bundling
- Replit-specific development tools

## Deployment Strategy

The application is configured for deployment on Replit's infrastructure:

- **Development**: `npm run dev` starts both frontend and backend with hot reload
- **Build**: `npm run build` creates production builds for both client and server
- **Production**: `npm run start` runs the production server
- **Database**: Uses Neon PostgreSQL with connection pooling
- **Port Configuration**: Server runs on port 5000, exposed as port 80 externally

The build process:
1. Frontend builds to `dist/public` directory
2. Backend bundles to `dist/index.js`
3. Static files are served by the Express server in production

## Changelog

Changelog:
- June 17, 2025. Initial setup  
- July 1, 2025. Fixed critical cache persistence bug - React Query cache now clears on logout to prevent stale data across user sessions
- July 1, 2025. Fixed major campaign display issues:
  - Landing pages now properly save to database during campaign creation
  - UTM links store correct target URLs extracted from generated links  
  - Fixed database query ordering to show newest campaigns first (was showing oldest)
  - Increased record limit to 100 to display more campaigns
  - Added manual refresh button to bypass browser cache issues
  - RESOLVED: Fixed API route default limit (was 20, now 100) - all campaigns now display correctly
- July 2, 2025. Fixed landing page mapping and added validation:
  - Fixed landing page dropdown bug in edit mode using robust URL normalization
  - Added duplicate URL validation in Section 1 with user-friendly error messages
  - Implemented column reordering in Section 4: Landing Page, Medium, Content, Link Name, UTM Link

## User Preferences

Preferred communication style: Simple, everyday language.