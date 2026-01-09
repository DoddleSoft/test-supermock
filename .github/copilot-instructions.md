# SuperMock IELTS Test Platform - AI Coding Instructions

## Project Overview

SuperMock is a Next.js 16 (App Router) IELTS exam preparation platform supporting four test modules: Reading, Writing, Listening, and Speaking. Built with TypeScript, React 19, Tailwind CSS 4, and Supabase for backend services.

## Architecture & Module Structure

### Test Module Pattern

Each IELTS module follows a consistent architecture:

- **Route**: `app/mock-test/{module}/page.tsx` (e.g., `reading`, `listening`, `writing`, `speaking`)
- **Context Provider**: `context/{Module}Context.tsx` - manages module state, timer, answers, navigation
- **Helper Functions**: `helpers/{module}.ts` - data fetching, validation, submission logic
- **Navbar Component**: `component/modules/{Module}Navbar.tsx` - module-specific UI with timer
- **Dummy Data**: `dummy/{module}.ts` - mock data structures matching Supabase schema

**Example**: Reading module uses `ReadingContext.tsx` with state for passages, questions, answers (as Map), timer, and computed values (completion %, flagged count). Helper functions in `helpers/reading.ts` fetch from Supabase and provide utilities like `getTotalQuestions()`, `validateAnswer()`, `submitReadingAnswers()`.

### Data Flow

1. Auth via sessionStorage (simple login in `app/auth/login/page.tsx`)
2. Module selection from `app/mock-test/page.tsx`
3. Module page initializes context provider wrapping test UI
4. Context loads data via helper functions from Supabase or dummy files
5. Timer starts, user navigates passages/questions, submits answers
6. Submit function in helper sends to Supabase with student_id

### Database Schema Pattern

Tables follow this structure (inferred from `helpers/reading.ts`):

- **modules**: `module_id`, `title`, `paper_id`, `module_type`, `duration_minutes`, `center_id`, `order_index`, `max_file_size_mb`
- **passages**: `passage_id`, `module_id`, `title`, `heading`, `passage_index`, `instruction`, `content_type`, `media_path`
- **questions**: `question_id`, `passage_id`, `question_no`, `type`, `options`, `correct_answer`, `marks`, `order_index`, `analyze`

Question types: `"blanks" | "mcq" | "boolean" | "essay" | "short_answer"`

## Key Conventions

### State Management

- Use **Context API** with custom providers for module-level state (not Redux/Zustand)
- Answer storage uses `Map<string, Answer>` for O(1) lookups by question_id
- Computed values (totalQuestions, completionPercentage, flaggedCount) are derived in context, not stored

### Component Patterns

- `"use client"` directive required for interactive components (all test pages, auth, navbars)
- Client-side navigation with `useRouter()` from `next/navigation`
- Authentication check via sessionStorage in `useEffect`, redirect to `/auth/login` if missing
- Timer logic: `setInterval` in `useEffect`, cleanup on unmount, auto-start after user begins

### Styling

- Tailwind CSS 4 with utility-first approach
- Responsive design: mobile-first, use `md:`, `lg:` breakpoints
- Navbar pattern: Fixed position, rounded-2xl container, backdrop-blur on scroll (see `ReadingNavbar.tsx`)
- Colors: Green for reading (`green-50`, `green-600`), consistent across module icons

### Path Aliases

- `@/*` resolves to root directory (configured in `tsconfig.json`)
- Always use `@/component/`, `@/helpers/`, `@/context/`, `@/utils/`, `@/dummy/`

### Supabase Integration

- Client creation: `createClient()` from `@/utils/supabase/client.ts`
- Uses `@supabase/ssr` with browser client
- Env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
- Queries use `.select()`, `.eq()`, `.order()`, `.single()` pattern

## Development Workflow

**Run dev server**: `pnpm dev` (opens at http://localhost:3000)
**Build**: `pnpm build`
**Lint**: `pnpm lint` (uses ESLint 9)

**Authentication flow**:

1. Root `/` auto-redirects to `/mock-test`
2. All module pages check sessionStorage for `authenticated` + `studentId`
3. Missing auth redirects to `/auth/login?module={module}`
4. Login stores sessionStorage, redirects back to `/mock-test`

**Adding new modules**:

1. Create `app/mock-test/{module}/page.tsx` with test UI
2. Add `context/{Module}Context.tsx` with provider pattern
3. Create `helpers/{module}.ts` with fetch/validation functions
4. Add dummy data in `dummy/{module}.ts` matching schema
5. Create `component/modules/{Module}Navbar.tsx` for timer/navigation

## Common Patterns to Follow

**Fetching module data**:

```typescript
// In helpers file
export async function fetchModuleData(moduleId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("modules")
    .select("*")
    .eq("module_id", moduleId)
    .single();
  // Handle nested fetches for passages/questions
}
```

**Context provider structure**:

```typescript
interface ContextType {
  // Data
  module: Module | null;
  isLoading: boolean;
  // State
  currentIndex: number;
  answers: Map<string, Answer>;
  // Actions
  loadModule: (id: string) => Promise<void>;
  submitAnswer: (questionId: string, answer: any) => void;
  // Computed
  totalQuestions: number;
}
```

**Timer formatting**: Use `formatTime(seconds)` pattern returning `MM:SS` string with zero-padding

## Project-Specific Notes

- **No server components for tests**: All test pages are client components due to timer/state requirements
- **SessionStorage over cookies**: Auth uses sessionStorage (not production-ready, intentional for prototype)
- **Dummy data structure mirrors DB**: Type safety via shared interfaces between helpers and dummy files
- **Passage navigation**: Use passage_index (1-indexed) for UI, passage_id for DB operations
- **Question numbering**: Display via `question_no` field, not array indices
