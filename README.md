# TaskMaster SaaS

A modern, full-stack task management platform with real-time collaboration, multi-workspace support, and enterprise-grade features. Built with cutting-edge technologies and best practices for scalability and performance.

## ✨ Key Features

### 🔐 Authentication & Security
- **Secure JWT Authentication** with HttpOnly cookies
- **Firebase Google OAuth** integration for seamless login
- **Email/Password Authentication** with bcrypt password hashing
- **Protected Routes** with middleware authorization
- **Role-Based Access Control (RBAC)** - Admin, Owner, Member roles

### 🏢 Multi-Workspace Management
- **Organization/Workspace System** - Create and manage multiple workspaces
- **Workspace Switcher** - Seamlessly switch between different organizations
- **Team Invitations** - Email-based member invitations with Firebase
- **Member Management** - Add, remove, and manage team members
- **Role Assignment** - Owner, Admin, and Member roles per workspace

### ✅ Task Management
- **Full CRUD Operations** - Create, read, update, and delete tasks
- **Task Prioritization** - Low, Medium, High priority levels
- **Status Tracking** - TODO, IN_PROGRESS, DONE statuses
- **Rich Task Details** - Title, description, and metadata
- **Real-time Updates** - Socket.IO integration for live task updates
- **Team/Private Tasks** - Workspace-scoped or personal tasks

### 📊 Dashboard & Analytics
- **Real-time Statistics** - Active users, tasks overview, team metrics
- **Activity Feed** - Live activity logs with real-time updates
- **Task Distribution Charts** - Visual representation of task status
- **Team Performance Metrics** - Member activity tracking

### 🎨 Modern UI/UX
- **Responsive Design** - Fully optimized for mobile, tablet, and desktop
- **Mobile Navigation** - Hamburger menu with slide-out drawer
- **Dark/Light Mode Support** - System-based theme detection
- **Premium Components** - Built with Radix UI and shadcn/ui
- **Smooth Animations** - Micro-interactions and transitions
- **Accessibility** - WCAG compliant with ARIA labels

### 🔔 Real-time Features
- **Socket.IO Integration** - Bidirectional event-based communication
- **Live Task Updates** - See changes as they happen
- **Activity Notifications** - Real-time activity feed updates
- **User Presence** - Track active users in workspace

### 📱 Responsive Features
- **Mobile-First Design** - Optimized layouts for all screen sizes
- **Card-Based Mobile Views** - Table alternatives for small screens
- **Touch-Optimized** - Large tap targets and gesture support
- **Progressive Enhancement** - Works on all modern browsers

## 🛠️ Tech Stack

### Frontend
- **[Next.js 14](https://nextjs.org/)** - React framework with App Router
- **[TypeScript](https://www.typescriptlang.org/)** - Type-safe development
- **[Tailwind CSS](https://tailwindcss.com/)** - Utility-first CSS framework
- **[shadcn/ui](https://ui.shadcn.com/)** - Re-usable component library
- **[Radix UI](https://www.radix-ui.com/)** - Unstyled, accessible components
- **[Zustand](https://zustand-demo.pmnd.rs/)** - Lightweight state management
- **[Socket.IO Client](https://socket.io/)** - Real-time client library
- **[Lucide React](https://lucide.dev/)** - Beautiful icon library
- **[Sonner](https://sonner.emilkowal.ski/)** - Toast notifications
- **[date-fns](https://date-fns.org/)** - Modern date utility library

### Backend
- **[Node.js](https://nodejs.org/)** - JavaScript runtime
- **[Express.js](https://expressjs.com/)** - Web application framework
- **[TypeScript](https://www.typescriptlang.org/)** - Type-safe backend
- **[Prisma ORM](https://www.prisma.io/)** - Next-generation ORM
- **[PostgreSQL](https://www.postgresql.org/)** - Relational database
- **[Socket.IO](https://socket.io/)** - Real-time engine
- **[JWT](https://jwt.io/)** - JSON Web Tokens for auth
- **[bcrypt](https://github.com/kelektiv/node.bcrypt.js)** - Password hashing
- **[Firebase Admin](https://firebase.google.com/docs/admin/setup)** - Email services & OAuth
- **[CORS](https://github.com/expressjs/cors)** - Cross-Origin Resource Sharing
- **[cookie-parser](https://github.com/expressjs/cookie-parser)** - Cookie middleware

## 🏗️ Architecture

### Database Schema
```
User
├── id (String, UUID)
├── email (String, unique)
├── name (String)
├── password (String, optional for OAuth)
├── role (ADMIN | USER)
├── tasks (relation)
├── memberOf (relation to Member)
└── ownedOrganizations (relation)

Organization
├── id (String, UUID)
├── name (String)
├── ownerId (String)
├── members (relation to Member)
└── tasks (relation)

Member
├── id (String, UUID)
├── userId (String)
├── organizationId (String)
├── role (OWNER | ADMIN | MEMBER)
└── invitedBy (String)

Task
├── id (String, UUID)
├── title (String)
├── description (String)
├── status (TODO | IN_PROGRESS | DONE)
├── priority (LOW | MEDIUM | HIGH)
├── userId (String)
├── organizationId (String, optional)
└── visibility (private | team)
```

### API Endpoints

#### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login with credentials
- `POST /api/auth/google` - Google OAuth login
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/me` - Get current user

#### Tasks
- `GET /api/tasks` - Get all tasks (user + workspace)
- `POST /api/tasks` - Create new task
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task

#### Organizations
- `GET /api/organizations` - Get user's organizations
- `POST /api/organizations` - Create organization
- `GET /api/organizations/:id/members` - Get members
- `DELETE /api/organizations/:id/members/:userId` - Remove member

#### Invitations
- `POST /api/invitations/send` - Send invitation email
- `GET /api/invitations/:token` - Get invitation details
- `POST /api/invitations/:token/accept` - Accept invitation

#### Users (Admin)
- `GET /api/users` - Get all users (admin only)
- `DELETE /api/users/:id` - Delete user (admin only)

### Real-time Events (Socket.IO)
- `task:created` - New task created
- `task:updated` - Task modified
- `task:deleted` - Task removed
- `activity:new` - New activity log
- `user:connected` - User joined workspace
- `user:disconnected` - User left workspace

## 🚀 Getting Started

### Prerequisites
- **Node.js** (v18 or higher)
- **PostgreSQL** (v14 or higher)
- **Firebase Project** (for OAuth and email services)
- **npm** or **yarn** package manager

### Environment Setup

#### Backend (.env)
Create `server/.env`:
```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/taskmaster"

# JWT Secret
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"

# Server
PORT=5000
NODE_ENV=development

# Frontend URL
CLIENT_URL=http://localhost:3000

# Firebase Admin (for email services)
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_PRIVATE_KEY="your-firebase-private-key"
FIREBASE_CLIENT_EMAIL=your-firebase-client-email
```

#### Frontend (.env.local)
Create `client/.env.local`:
```env
# API URL
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_SOCKET_URL=http://localhost:5000

# Firebase Client Config
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
```

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd task-manager-saas
   ```

2. **Install dependencies**
   ```bash
   # Backend
   cd server
   npm install
   
   # Frontend
   cd ../client
   npm install
   ```

3. **Database setup**
   ```bash
   cd server
   npx prisma generate
   npx prisma db push
   ```

4. **Run the application**
   ```bash
   # Terminal 1 - Backend
   cd server
   npm run dev
   
   # Terminal 2 - Frontend
   cd client
   npm run dev
   ```

5. **Access the application**
   - Frontend: [http://localhost:3000](http://localhost:3000)
   - Backend API: [http://localhost:5000](http://localhost:5000)
   - Socket.IO: ws://localhost:5000

## 📖 Usage

### First Time Setup

1. **Register an Account**
   - Visit `http://localhost:3000/register`
   - Create your account with email/password or Google OAuth

2. **Create a Workspace**
   - After login, create your first organization/workspace
   - Name it and start managing tasks

3. **Invite Team Members**
   - Navigate to Team Settings
   - Click "Invite Member" and enter email
   - Team member receives invitation via email

4. **Start Managing Tasks**
   - Create tasks with title, description, priority, and status
   - Real-time updates across all team members
   - Switch between workspaces as needed

### Admin Access

To make a user an Admin:
```sql
UPDATE "User" SET role = 'ADMIN' WHERE email = 'admin@example.com';
```

Admin users get access to:
- User management dashboard
- Delete any user
- View all system users

## 🎯 Features in Detail

### Workspace System
- Create unlimited workspaces/organizations
- Each workspace has independent task lists
- Invite team members with specific roles
- Workspace owner has full control

### Task Management
- Create tasks scoped to workspace or personal
- Priority levels help organize work
- Status tracking for workflow management
- Real-time synchronization across team

### Real-time Collaboration
- See task updates instantly
- Activity feed shows team actions
- Socket.IO ensures low-latency updates
- Automatic reconnection handling

### Responsive Design
- Desktop: Full-featured sidebar navigation
- Mobile: Hamburger menu with drawer
- Tablet: Optimized layouts
- Cards replace tables on small screens

## 📄 License

This project is licensed under the MIT License.

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

## 📧 Contact

For questions or support, please open an issue in the repository.

---

**Built with ❤️ using modern web technologies**
