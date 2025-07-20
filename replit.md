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

## Security Architecture

### Account-Level Data Isolation
- **User Authentication**: Firebase UID + Bearer token validation
- **Database Constraints**: All tables have foreign key constraints to users.id
- **API Authorization**: Every protected endpoint validates user ownership
- **Input Validation**: Campaign names, limits, and all user inputs are validated
- **Multi-User Support**: Architecture supports multiple users per account (future feature)

### Security Validations Implemented
- **Source Templates**: Users can only CRUD their own templates
- **UTM Links**: All operations scoped to user's data only
- **Campaign Operations**: Archive/unarchive limited to user's campaigns
- **Landing Pages**: Access restricted to user's campaign data
- **Parameter Limits**: API query limits capped (max 1000 records)
- **SQL Injection Protection**: Using Drizzle ORM with parameterized queries

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
  - Added row sorting in Section 4 to match Landing Page URL Labels order from Section 1
- July 2, 2025. Major edit mode improvements:
  - Simplified landing page interface - removed single/multiple choice, always show landing page list
  - Fixed critical edit mode bug: each row now shows its original landing page instead of random distribution
  - Improved exact URL matching to preserve original UTM link configurations when editing campaigns
  - Added row removal functionality with red X buttons in Campaign Links section
  - Removed expandable/collapsible sections - all sections now always visible
  - Simplified interface by removing section toggle functionality
  - Removed NEXT buttons and section-by-section validation
  - Cleaned up unused ChevronDown/ChevronUp imports
  - Adjusted Landing Page URL fields and Add Landing Page button to use proper width (w-96) for better visual alignment
  - Fixed critical edit mode bug: changing campaign name now properly updates the existing campaign instead of creating a new one
  - Added originalCampaignName tracking to ensure proper deletion of existing UTM links and landing pages during campaign updates
- July 2, 2025. Step 8 completed - Column header sorting functionality:
  - Added clickable column headers for Landing Page, Medium, and Content columns
  - Implemented ascending/descending sort with chevron indicators
  - Sort state preserved per source template for independent sorting
  - Hover effects and visual feedback for clickable headers
  - Enhanced user control over Campaign Links table organization
- July 2, 2025. Campaign Management page improvements completed:
  - Step 1: Added landing page URLs display under each campaign name in headers
  - Step 2: Implemented UTM Links count display between landing pages and tags
  - Step 3: Added Archive Campaign functionality with confirmation dialog
  - Step 4: Removed refresh button and debug info section for cleaner interface
  - Step 5: Added "Landing Page" column to UTM links table showing target URLs
  - Removed "Campaign" text from all buttons for cleaner interface (Edit, Copy Links, Archive)
  - Archive button styled in red to indicate destructive action
  - Simplified query client by removing cache-bypassing refresh logic
  - Enhanced links table with Landing Page column in both desktop and mobile layouts
  - Updated table column widths to be more dynamic with flexible sizing (1fr for Landing Page and UTM Link columns)
  - Added text wrapping to Landing Page field for better content visibility, similar to UTM Link field
  - Improved desktop grid layout: Landing Page (1fr), Medium (120px), Content (150px), Link name (200px), UTM Link (1fr), Actions (80px)
- July 2, 2025. Converted archive functionality from hard deletion to soft deletion:
  - Added isArchived fields to utm_links and campaign_landing_pages tables
  - Updated API endpoints to support archive/unarchive operations
  - Modified CampaignCard to show archive/unarchive buttons based on status
  - Added toggle in Campaign Management page to view archived campaigns
  - Implemented comprehensive security audit ensuring account-level data isolation
- July 2, 2025. Comprehensive security hardening completed:
  - Enhanced authentication middleware with Bearer token validation
  - Added user ownership validation for all CRUD operations
  - Implemented input validation and sanitization across all endpoints
  - Added parameter limits and SQL injection protection
  - Updated all storage methods to enforce user-scoped data access
  - Prepared architecture for multi-user account support
- July 16, 2025. UTM Template System Implementation:
  - Added comprehensive UTM templates database with 72 pre-populated source, medium, and content combinations
  - Created automatic database seeding of UTM templates on server startup
  - Built API endpoints for fetching UTM content suggestions by source and medium combinations
  - Integrated auto-population functionality in campaign creation workflow
  - Redesigned campaign creation with separate Sources and Mediums sections for better UX
  - Implemented auto-population of UTM content when users select source and medium combinations
  - Added user-friendly toast notifications when content suggestions are populated
  - Users can now easily remove unwanted auto-populated content rows for streamlined workflow
  - Enhanced campaign creation efficiency by reducing manual UTM content entry
- July 17, 2025. UI/UX fixes and Landing Page URL autocomplete:
  - Fixed automatic column sorting bug - removed unwanted auto-sorting that triggered when changing fields
  - Manual column header sorting functionality preserved for user-controlled organization
  - Fixed "Add Landing Page" button bug where first click now properly adds new input field instead of just showing delete button
  - Implemented Landing Page URL autocomplete functionality with unique URLs from user's account history
  - Added /api/unique-urls endpoint that fetches all previously used URLs from campaign landing pages and UTM links
  - Landing Page URL fields now show dropdown suggestions for easy reuse of previous URLs
  - Enhanced user experience by eliminating need to retype commonly used landing page URLs
- July 17, 2025. Campaign Management page enhancements:
  - Added clickable tag filtering system with "All", individual tags, and "Untagged" filter options
  - Implemented landing page URLs display above UTM Links count on campaign cards with mobile responsive design
  - Enhanced data integration to fetch and combine campaign landing pages with UTM link target URLs
  - Fixed edit campaign mode navigation: "Back to Home" link now reads "Back to Campaign Management" and navigates to campaigns page
  - Added visual filter section with clickable badges showing active filter states
  - Both desktop and mobile layouts support the new filtering and URL display features
- July 17, 2025. Settings page implementation and navigation restructure:
  - Removed Source & Medium Management card from main home page
  - Added Settings dropdown menu option under user profile in top navigation
  - Created dedicated Settings page (/settings) with proper authentication
  - Moved Source & Medium Management functionality to Settings page with improved button sizing
  - Updated home page layout from 3-column to 2-column grid for better visual balance
  - Added placeholder cards for future Account Settings and Notifications features
  - Enhanced button text accommodation for "Manage Sources & Mediums" with proper sizing and spacing
- July 17, 2025. Tag Management system implementation:
  - Added Tag Management quadrant to Settings page with navigation to dedicated Tag Management page
  - Created comprehensive Tag Management page showing tag usage statistics (campaign count and UTM link count per tag)
  - Implemented create and delete tag functionality with proper API endpoints and database operations
  - Fixed schema validation issues for tag creation by correcting insertTagSchema structure
  - Added smart tag cleanup that removes deleted tags from all associated UTM links
  - Enhanced security with user-scoped operations and proper authentication validation
  - Added tag editing functionality with inline editing interface
  - Implemented PUT /api/tags/:id endpoint for updating tag names
  - When tags are updated, all associated UTM links automatically reflect the new tag name
  - Enhanced delete confirmation to explain that campaigns without remaining tags will be marked as "Untagged"
  - Added proper validation to prevent duplicate tag names during editing
- July 17, 2025. Brand identity and navigation enhancement:
  - Created UTM Builder logo component with gradient design and Zap icon
  - Added logo to top-left corner of all main pages (HomePage, CampaignManagement, Settings, TagManagement, NewCampaign)
  - Logo always links back to home page for consistent navigation
  - Implemented responsive design with proper spacing and hover effects
  - Enhanced visual brand consistency across the entire application
  - Updated main heading on HomePage from "UTM Link Builder" to "UTM Builder" for consistent branding
- July 17, 2025. Chat Wizard implementation:
  - Created conversational Chat Wizard that guides users through campaign creation step by step
  - Added Chat Wizard as first quadrant on home page with prominent gradient button design
  - Implemented intelligent conversation flow covering all Campaign Wizard elements
  - Added clickable options for sources, mediums, tags, and content suggestions to minimize typing
  - Integrated with existing UTM template system for auto-populated content suggestions
  - Built smart conversation flow that adapts based on user selections and available data
  - Added proper URL validation and landing page management through chat interface
  - Created dedicated /chat-wizard route with full authentication and navigation
  - Chat interface includes typing indicators, message history, and seamless campaign creation
  - Enhanced Chat Wizard with campaign type selection (existing vs new campaign)
  - Added display of 10 latest existing campaigns as clickable options for adding links
  - Implemented multiple landing page URL selection with top 10 most-used URLs as suggestions
  - Fixed medium selection error handling to prevent undefined charAt errors
  - Added support for multiple source selection with progress tracking
  - Enhanced user experience with clear progress indicators and option management
- July 17, 2025. Chat Wizard feedback loop bug fix:
  - Fixed critical campaign creation feedback loop that was causing 92 duplicate UTM links
  - Restructured campaign creation flow to use individual API calls (POST /api/campaign-landing-pages and POST /api/utm-links)
  - Added isCreatingCampaign state management to prevent multiple simultaneous creation attempts
  - Enhanced button disabling during campaign creation to prevent double-clicks
  - Separated campaign creation logic from final options display to eliminate recursive calls
  - Campaign creation now properly creates landing pages first, then UTM links sequentially
  - Fixed mutation success flow to call showFinalOptions() only after successful creation
  - Enhanced error handling with proper state reset on both success and error scenarios
- July 17, 2025. Chat Wizard stale closure fix:
  - Fixed critical stale closure issue where createCampaign function was using empty campaign data
  - Implemented React functional state update pattern to ensure access to most current campaign data
  - Campaign creation now properly validates and uses populated data from conversation flow
  - Eliminated race condition between state updates and campaign creation button clicks
  - Chat Wizard now successfully creates campaigns with proper data from user interactions
- July 17, 2025. Chat Wizard auto-expand functionality:
  - Fixed "View Campaign" button to automatically expand created campaign in Campaign Management page
  - Added expandCampaign prop to GeneratedLinks component for auto-expansion control
  - Modified navigation to pass campaign name as URL parameter (?expand=campaignName)
  - Added useEffect hook to detect and expand specified campaign when page loads
  - Enhanced user experience by eliminating need to manually click "Show Links" after campaign creation
  - Campaign Management page now reads URL parameters and automatically expands the relevant campaign
- July 17, 2025. Chat Wizard content template integration:
  - Added content template selection step after medium selection in Chat Wizard flow
  - Integrated with existing UTM content API (/api/utm-content/:source/:medium) to fetch content suggestions
  - Updated CampaignData interface to include selectedContent field for managing content variations
  - Auto-selects all available content templates for each source-medium combination
  - Generates separate UTM links for each content variation instead of defaulting to "default"
  - Enhanced campaign creation to support multiple content variations per source-medium pair
  - Updated both campaign creation and copy links functionality to use content templates
  - Replaced manual content input with automated content template selection for better user experience
  - Fixed UTM link generation bug where Chat Wizard was passing incorrect parameters to generateUTMLink function
  - Updated Chat Wizard copy functionality to match Campaign Management page format with organized source sections and labeled links
- July 17, 2025. Chat Wizard existing campaigns bug fixes:
  - Fixed infinite loading loop caused by recursive setTimeout calls in showExistingCampaigns function
  - Resolved React stale closure issues by accessing query data directly inside functions rather than destructuring at component level
  - Added useEffect to monitor query completion and automatically display campaigns when data loads
  - Eliminated timeout issues where existing campaigns would get stuck in loading state
  - Fixed button text for existing campaign path: "Create Campaign" now shows "Add Links to Campaign" for better UX clarity
  - Enhanced error handling and removed debug console logs for cleaner production code
  - Fixed all button text across multiple Chat Wizard paths (review step, tag selection, skip tags)
  - Updated status messages: "Creating your campaign" → "Adding links to your campaign" for existing campaigns
  - Updated success message: "Your campaign has been created" → "Your links have been added to your campaign" for existing campaigns
  - Comprehensive UX improvements ensuring consistent messaging throughout the existing campaign flow
- July 18, 2025. Major template system architectural overhaul completed:
  - Migrated from single utm_templates table to base_utm_templates and user_utm_templates for proper data isolation
  - Created setup script to migrate existing data and create user-specific template copies for all existing users
  - Updated all API endpoints to work with new user template system while maintaining backward compatibility
  - Fixed authentication issues in Template Management page by adding both Authorization and x-firebase-uid headers
  - Updated Template Management page to display base templates (green badges) vs custom templates (blue badges with *)
  - Enabled deletion/archiving of both base and custom content templates for full user control
  - New users automatically receive copies of all base templates upon registration
  - Template system now fully supports multi-user isolation with shared base templates and individual customization
- July 18, 2025. Enterprise multi-user account system implementation (Phases 1-2 complete):
  - Phase 1: Database schema updates with new accounts, user_accounts, and invitations tables completed
  - Migrated existing users to personal accounts with super_admin roles automatically
  - Fixed Drizzle schema issues (serial vs integer column types) for proper account_id handling
  - Phase 2: Backend API development completed with comprehensive account management endpoints
  - Implemented user invitation system with secure token-based acceptance flow
  - Added role-based access control (super_admin, admin, user) with proper authorization
  - Account management API endpoints tested and fully functional (create accounts, invite users, manage roles)
  - Enhanced security with account-scoped data isolation and proper permission validation
- July 19, 2025. Major architectural restructure to company-based account model:
  - BREAKING CHANGE: Removed userAccounts junction table - users now belong to ONE account only
  - Updated users table with direct accountId foreign key, role, and invitedBy fields
  - Simplified architecture: Account = Company, User belongs to one company account
  - Updated all API endpoints to work with single-account model
  - Fixed invitation system to create users directly in invited company accounts
  - Migrated existing users to have proper account associations with super_admin roles
  - Eliminated account switching complexity - users have one company account
- July 19, 2025. Critical Firebase configuration and routing fixes:
  - Fixed application startup issues caused by missing VITE_FIREBASE_PROJECT_ID environment variable
  - Resolved routing configuration problems that were causing 404 errors on all pages
  - Database migration completed successfully with proper account_id, role, invited_by, and joined_at columns
  - All existing users migrated to individual company accounts with super_admin roles
  - Firebase authentication now properly configured with complete environment variables
  - Application fully functional with Google sign-in and company-based account architecture
- July 20, 2025. Account Management authentication and hierarchy fixes:
  - Resolved critical authentication session mismatches between Firebase UID and database records
  - Cleaned database of duplicate users and conflicting account associations
  - Fixed React Query key structure causing API failures for users endpoint
  - Implemented proper company-based account hierarchy: new user signup creates company account, user becomes Super Admin
  - Account Management page now correctly displays users in their company accounts
  - Removed Super Admin badge from account display (user-only role indicator)
  - Renamed company account to "PlayMOps" 
  - Phase 1 foundation complete: Ready for Phase 2 multi-user invitation system implementation
- July 20, 2025. Modern UI/UX design implementation:
  - Applied professional color scheme: Primary blue (#1e40af), Secondary purple (#7c3aed), Accent cyan (#06b6d4)
  - Enhanced logo with modern gradient effects and hover animations
  - Updated all UI components with gradient buttons, modern cards, and smooth transitions
  - Redesigned AuthScreen with professional styling and improved user experience
  - Fixed ChatWizard authentication issues and applied modern design consistency
  - Enhanced typography hierarchy and added subtle animations throughout the application
- July 20, 2025. Chat Wizard bug fixes and template architecture correction:
  - Fixed content variations showing "default" instead of proper UTM content suggestions
  - Resolved tag display issue in campaign summary by fixing stale closure problems
  - Fixed campaign creation API failures by adding required accountId fields to all requests
  - Corrected template architecture: Base templates are copied to user accounts during registration (not referenced)
  - Updated UTM content API to only fetch from user templates since base templates are copied during signup
  - Enhanced tag selection flow to use review step before campaign creation for better UX
  - Fixed authentication middleware to ensure proper user account data is included in API requests
  - Fixed API call authentication issue by correcting apiRequest function parameter order in Chat Wizard
  - Content suggestions now properly show real UTM variations: "text-ad", "responsive-ad", "shopping-ad", etc.
  - Campaign creation fully functional with proper content templates and tag support
  - Fixed UTM link count calculation in campaign summary to account for multiple content variations per source-medium combination

## User Preferences

Preferred communication style: Simple, everyday language.