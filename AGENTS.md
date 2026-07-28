# PermisosBE — Agent Guide

## Project Structure

```
permisosbe/
├── packages/
│   ├── backend/          # Express + TypeScript + PostgreSQL
│   │   ├── src/
│   │   │   ├── config/       # database.ts, env.ts
│   │   │   ├── controllers/  # Request handlers (object literals)
│   │   │   ├── middleware/    # auth.ts, permissions.ts
│   │   │   ├── repositories/ # DB queries per entity
│   │   │   ├── routes/       # Express routers
│   │   │   ├── services/     # Business logic
│   │   │   ├── types/        # TypeScript interfaces
│   │   │   ├── seeds/        # DB seed script
│   │   │   ├── __tests__/    # Jest tests
│   │   │   ├── index.ts      # Express app setup
│   │   │   └── server.ts     # Entry point
│   │   ├── migrations/       # node-pg-migrate
│   │   ├── jest.config.js
│   │   └── tsconfig.json
│   └── frontend/         # React + Vite + Tailwind CSS
│       ├── src/
│       │   ├── components/   # Reusable UI (DataTable, Modal, Sidebar, etc.)
│       │   ├── contexts/     # AuthContext
│       │   ├── pages/        # Route pages
│       │   ├── services/     # api.ts (axios calls)
│       │   ├── types/        # TypeScript interfaces
│       │   ├── utils/        # format.ts (date formatting)
│       │   ├── __tests__/    # Vitest tests
│       │   ├── App.tsx       # Router setup
│       │   └── main.tsx      # Entry point
│       ├── vite.config.ts
│       └── tsconfig.json
├── package.json           # npm workspaces root
├── formato.docx           # Reference for certificate PDF
└── AGENTS.md              # This file
```

## Commands

All commands run from the repo root (`C:\Users\admin\Documents\agentes\permisosbe`).

### Backend (`packages/backend`)

| Command | Purpose |
|---------|---------|
| `npm run dev -w @permisosbe/backend` | Start dev server (ts-node-dev, auto-restart) |
| `npm run build -w @permisosbe/backend` | Compile TypeScript + copy migrations |
| `npm test -w @permisosbe/backend` | Run all Jest tests |
| `npx jest --forceExit src/__tests__/health.test.ts` | Run a single test file |
| `npm run migrate:up -w @permisosbe/backend` | Apply pending migrations |
| `npm run migrate:down -w @permisosbe/backend` | Rollback last migration |
| `npm run seed -w @permisosbe/backend` | Seed DB (roles, admin user, config) |

### Frontend (`packages/frontend`)

| Command | Purpose |
|---------|---------|
| `npm run dev -w @permisosbe/frontend` | Start Vite dev server (port 5173) |
| `npm run build -w @permisosbe/frontend` | TypeScript check + Vite build |
| `npm test -w @permisosbe/frontend` | Run all Vitest tests |
| `npx vitest run src/__tests__/Login.test.tsx` | Run a single test file |

### Type Checking

```
npx tsc --noEmit --project packages/backend/tsconfig.json
npx tsc --noEmit --project packages/frontend/tsconfig.json
```

### Linting

No linter (ESLint) is configured in this project.

## Code Style Guidelines

### Imports & Formatting
- Use single quotes for all import/require statements
- Use semicolons at end of statements
- Indent with 2 spaces
- Separate import groups: external libs first, then internal modules (no blank line between)
- Backend: CommonJS `require()` style imports compiled from ESM-style `import` (via ts-jest)
- Frontend: True ESM with `import` statements

### Types
- All shared interfaces live in `packages/{backend,frontend}/src/types/index.ts`
- Backend and frontend have separate (often duplicated) type definitions
- Use `interface` for data shapes, not `type`
- Optional fields use `?` (e.g. `fecha_fin?: string`)
- Union types for constrained values (e.g. `'completa' | 'media'`)
- Avoid `any` when possible; prefer proper types
- Backend uses `Promise<T | null>` for find-or-null patterns
- Route query params are typed manually, not auto-inferred

### Naming Conventions
- **camelCase**: variables, functions, object methods, file names
- **PascalCase**: TypeScript interfaces, React components
- **snake_case**: Database column names, migration column definitions, JSON API response fields (mirrors DB)
- **Routes**: kebab-case paths (`/mis-permisos`, `/gestion-permisos`)
- **Files**: camelCase with dots separating concern (`permiso.controller.ts`, `user.repository.ts`)

### Architecture Patterns
- **Controllers**: Object literals with async arrow function methods (`export const permisoController = { async method(req, res) { ... } }`)
- **Services**: Same object-literal pattern (`export const permisoService = { ... }`)
- **Repositories**: Same pattern (`export const userRepository = { ... }`)
- **Routes**: `const router = Router()` → attach handlers → `export default router`
- **Middleware**: Named function exports (`export const authenticate = (...) => { ... }`)
- **React components**: `export function ComponentName()` for named, `export default function PageName()` for pages

### Error Handling
- Controllers wrap logic in `try/catch`, returning `res.status(500).json({ message: '...' })` on error
- Use early `return` after `res.status(4xx).json(...)` to stop execution
- Validation errors return 400 with a `message` string
- Auth errors return 401 with `message`
- Permission errors return 403 with `message`
- Not found returns 404 with `message`
- Do NOT throw exceptions from controllers; always use try/catch
- Services/repositories return `null` for not-found instead of throwing

### Express Patterns
- `req.user!` is used after `authenticate` middleware (non-null assertion is the convention)
- `parseInt()` for route params (`const id = parseInt(req.params.id)`)
- File downloads: set `Content-Type` and `Content-Disposition` headers, `res.send(buffer)`
- Dynamic imports via `require()` inside controllers for infrequently used modules

### React Patterns
- Functional components with hooks (`useState`, `useEffect`, `useMemo`/`useCallback` only when needed)
- Props typed with inline `interface` near the component definition
- Tailwind CSS for all styling (utility classes, no CSS modules)
- `lucide-react` for icons (import specific icons by name)
- API calls via `api.ts` service object (axios instance with interceptors)
- Download flow: `api.get(..., { responseType: 'blob' })` → `URL.createObjectURL` → click anchor
- Error handling in async handlers: `try/catch` with `err: any` type and `alert()` for user feedback
- Conditional rendering with ternary/&&, guard clause for loading states

### Database
- PostgreSQL via `pg` Pool (singleton exported from `config/database.ts`)
- Parameterized queries with `$1, $2, ...` placeholders
- Migrations use `node-pg-migrate` with `pgm.createTable`, `pgm.addIndex`, etc.
- Date type parsers are overridden to return strings (not JS Date objects):
  ```
  types.setTypeParser(1082, (val: string) => val);  // DATE
  types.setTypeParser(1114, (val: string) => val);  // TIMESTAMP
  ```

### Testing
- **Backend (Jest)**: `supertest` for HTTP integration tests; `ts-jest` preset
- **Frontend (Vitest)**: `@testing-library/react`, `jsdom` environment
- Tests live in `__tests__/` directories next to source
- No mocks currently used; tests hit real Express app instance

### Git
- `.gitignore` excludes: `node_modules/`, `dist/`, `.env`, `*.log`, `.DS_Store`, `coverage/`, `nul`, `*.tsbuildinfo`
- Only commit when explicitly asked by the user.
