# AGENTS.md

## Project Overview

This is a full-stack project containing both:

* Python backend
* React frontend

The agent MUST distinguish between backend and frontend code.

Do not apply Python/Pylance rules to React/TypeScript files.

Do not apply React/TypeScript rules to Python files.

The primary goal is to maintain a clean, type-safe, testable, and production-ready codebase.

---

# 1. General Engineering Rules

Before modifying code:

1. Inspect the repository structure.
2. Identify whether the affected code belongs to:

   * Python backend
   * React frontend
   * shared configuration
   * infrastructure
3. Inspect existing project configuration.
4. Follow existing conventions.
5. Prefer root-cause fixes.
6. Avoid unnecessary refactoring.
7. Preserve existing runtime behavior.
8. Run appropriate validation after changes.

Do not make unrelated changes.

---

# 2. Project Boundaries

Treat the project as two primary applications.

## Python Backend

Typical indicators:

```text
.py
pyproject.toml
requirements.txt
requirements-dev.txt
poetry.lock
uv.lock
Pipfile
pyrightconfig.json
mypy.ini
```

Common tooling:

```text
Python
Pylance
Pyright
Ruff
Mypy
Pytest
```

## React Frontend

Typical indicators:

```text
.ts
.tsx
.js
.jsx
package.json
package-lock.json
pnpm-lock.yaml
yarn.lock
bun.lock
tsconfig.json
vite.config.*
next.config.*
```

Common tooling:

```text
React
TypeScript
ESLint
Prettier
Vite
Next.js
Jest
Vitest
Playwright
```

Always determine which side of the application a file belongs to before editing it.

---

# 3. Python Rules

## 3.1 Pylance / Pyright

Pylance/Pyright diagnostics are first-class engineering problems.

Do NOT optimize for:

> "Make VS Code stop showing red lines."

Optimize for:

> "Make the Python code and type information genuinely correct."

---

## 3.2 Never Hide Pylance Errors

Do not use these as shortcuts:

```python
# type: ignore
```

```python
# pyright: ignore
```

```python
# noqa
```

or:

```python
Any
```

when a real type can be provided.

Do not disable Pylance diagnostics.

Do not globally weaken Pyright configuration merely to remove errors.

Only use targeted suppression when there is a genuine external limitation and no reasonable alternative.

---

# 4. Diagnose Python Environment First

Before fixing many Pylance errors, determine:

* Python version
* Python executable
* virtual environment
* package manager
* installed dependencies
* source root
* project structure
* Pyright configuration
* VS Code Python configuration

Inspect:

```text
pyproject.toml
requirements.txt
requirements-dev.txt
poetry.lock
uv.lock
Pipfile
pyrightconfig.json
mypy.ini
.vscode/settings.json
```

If many imports are unresolved, investigate the environment before editing source code.

For example, if Pylance reports:

```text
Import "fastapi" could not be resolved
Import "pydantic" could not be resolved
Import "sqlalchemy" could not be resolved
```

do NOT modify those Python files immediately.

First determine whether VS Code is using the correct Python environment.

---

# 5. Python Type Safety

Prefer accurate types.

Example:

```python
def get_user(user_id: UUID) -> User | None:
    ...
```

instead of:

```python
def get_user(user_id) -> Any:
    ...
```

Avoid using `Any` simply to make Pylance happy.

Use appropriate typing constructs when necessary:

* `TypeAlias`
* `TypedDict`
* `Protocol`
* `TypeVar`
* generics
* `Literal`
* `Callable`
* `Annotated`
* `TypeGuard`
* `dataclass`
* unions
* `Optional`

Keep typing simple and readable.

---

# 6. Python Optional Values

If Pylance reports:

```text
Object of type "None" cannot be accessed
```

understand why the value can be `None`.

Prefer:

```python
if user is None:
    return

user.name
```

rather than suppressing the diagnostic.

Use assertions only when the invariant is genuinely guaranteed.

---

# 7. Python Imports

When an import cannot be resolved:

```text
Import "module" could not be resolved
```

investigate:

1. Is the package installed?
2. Is the correct interpreter selected?
3. Is the import path correct?
4. Is this a local package?
5. Is the project using `src/` layout?
6. Is the module generated?
7. Does Pyright know the source root?
8. Is the dependency compatible?

Do not add random:

```python
sys.path.append(...)
```

as a workaround.

Fix project configuration instead.

---

# 8. Python Third-Party Dependencies

When a dependency causes typing issues:

Check:

* installed version
* expected project version
* official type hints
* external type packages
* compatibility with the Python version

Do not immediately use `Any` or `type: ignore`.

---

# 9. Python Frameworks

Pay special attention to typing when working with:

* FastAPI
* Pydantic
* SQLAlchemy
* Redis
* async libraries
* Celery
* Django
* Flask

Use official typing patterns where available.

---

# 10. Python Async Code

Ensure:

* async functions are correctly typed
* coroutine results are awaited
* async generators are correctly typed
* sync and async APIs are not mixed
* async context managers are correctly typed

Example:

```python
async def get_user(user_id: UUID) -> User | None:
    ...
```

---

# 11. Python Database Code

When working with SQLAlchemy or other database libraries, pay attention to:

* nullable columns
* query result types
* model types
* repository return types
* session types
* async sessions
* relationships

If a Pylance error reveals a real mismatch, fix the boundary instead of suppressing the error.

---

# 12. React / TypeScript Rules

The React frontend has its own type-safety rules.

When editing `.ts` or `.tsx` files, use TypeScript diagnostics as the source of truth.

Typical validation tools include:

```bash
tsc --noEmit
```

and:

```bash
eslint .
```

Use the project's configured commands when available.

---

# 13. React Type Safety

Avoid:

```typescript
any
```

when a proper type can be defined.

Prefer:

```typescript
interface User {
  id: string;
  name: string;
  email: string;
}
```

instead of:

```typescript
const user: any = ...
```

Use:

* interfaces
* type aliases
* generics
* discriminated unions
* utility types
* type guards

when appropriate.

---

# 14. React Props

Components should have explicit props when appropriate.

Prefer:

```tsx
interface UserCardProps {
  user: User;
  onSelect: (user: User) => void;
}

function UserCard({
  user,
  onSelect,
}: UserCardProps) {
  ...
}
```

Avoid:

```tsx
function UserCard(props: any) {
  ...
}
```

---

# 15. React State

Use properly typed state.

Example:

```tsx
const [user, setUser] = useState<User | null>(null);
```

instead of:

```tsx
const [user, setUser] = useState<any>(null);
```

If the state has multiple states, consider a discriminated union.

---

# 16. API Types Between Python and React

The Python backend and React frontend communicate through APIs.

When modifying an API:

1. Inspect the backend request/response schema.
2. Inspect the frontend API client.
3. Check TypeScript types.
4. Check Pydantic/schema definitions.
5. Ensure both sides agree.

Do not fix a frontend type error by lying about the API response.

For example, if the backend returns:

```json
{
  "id": "123",
  "name": "John"
}
```

the frontend type should represent the actual response.

---

# 17. API Contract Changes

Be especially careful when changing:

* request bodies
* response structures
* field names
* nullable fields
* enum values
* pagination
* authentication responses
* error responses

A type change in the backend may require a corresponding frontend change.

Trace the entire flow:

```text
Python API
    ↓
HTTP Response
    ↓
API Client
    ↓
React Hook / Service
    ↓
Component
    ↓
UI
```

Do not fix only one layer if the contract is wrong across multiple layers.

---

# 18. React Imports

If TypeScript reports a missing module:

```text
Cannot find module
```

check:

1. Is the dependency installed?
2. Is the import path correct?
3. Is the file extension/path correct?
4. Is the alias configured?
5. Does `tsconfig.json` define the expected paths?
6. Is the package manager/environment correct?
7. Does the dependency actually exist?

Do not add fake declarations simply to silence the error unless the module genuinely lacks type definitions.

---

# 19. React Configuration

Inspect:

```text
package.json
tsconfig.json
vite.config.*
next.config.*
eslint.config.*
.prettierrc*
```

before changing frontend configuration.

Respect the project's existing framework.

Do not introduce another framework or build tool just to solve a type error.

---

# 20. React Hooks

When working with React hooks, pay attention to:

* dependency arrays
* stale closures
* state types
* effect cleanup
* async behavior
* memoization

Do not blindly add dependencies just to silence ESLint.

Understand why a dependency is required.

---

# 21. Do Not Break Backend While Fixing Frontend

When fixing React errors:

Do not modify the Python backend unless the frontend error exposes an actual API contract problem.

Likewise:

When fixing Python errors:

Do not modify the React frontend unless the backend change affects an API contract.

---

# 22. Validation Matrix

Use the appropriate validation depending on what changed.

## Python Only

Run, when available:

```bash
pyright
```

```bash
pytest
```

```bash
ruff check .
```

```bash
ruff format --check .
```

## React Only

Run, when available:

```bash
tsc --noEmit
```

```bash
eslint .
```

```bash
npm test
```

or the project's equivalent.

## Full-Stack / API Changes

Run both backend and frontend validation.

At minimum:

```text
Python type checking
Python tests
TypeScript type checking
Frontend tests
```

Use the project's actual commands.

---

# 23. Environment Problems vs Code Problems

Always distinguish configuration problems from source-code problems.

For example:

### Bad diagnosis

```text
50 Python imports are broken.
```

when the actual problem is:

```text
VS Code is using the wrong virtual environment.
```

Likewise:

```text
30 React modules are missing.
```

may actually mean:

```text
node_modules has not been installed.
```

Investigate the environment first.

---

# 24. When Editor and CLI Disagree

If VS Code shows errors but CLI tools do not:

### Python

Compare:

```text
VS Code Python interpreter
Pylance environment
Pyright environment
```

### React

Compare:

```text
VS Code TypeScript version
project TypeScript version
node_modules
tsconfig.json
```

Do not change application code simply because the editor and CLI disagree.

---

# 25. Root Cause First

When there are many errors, group them.

Example:

```text
Category:
Missing imports

Files affected:
20

Likely root cause:
Wrong virtual environment

Fix:
Correct Python interpreter
```

Do not patch 20 files individually if one configuration change fixes all of them.

---

# 26. Error Fixing Priority

Use this order:

```text
1. Environment
2. Dependency installation
3. Configuration
4. Import/module resolution
5. Core type definitions
6. API contracts
7. Function parameters
8. Return types
9. Optional values
10. Component props
11. State types
12. Generic/type inference issues
13. Minor warnings
```

---

# 27. Avoid Unnecessary Refactoring

When fixing diagnostics:

DO NOT:

* rewrite unrelated code
* change architecture
* rename unrelated variables
* upgrade dependencies unnecessarily
* introduce new frameworks
* replace working libraries
* restructure directories without reason

Make the smallest correct change.

---

# 28. Preserve Existing Behavior

Unless a diagnostic reveals a genuine bug, preserve:

* API behavior
* database behavior
* authentication
* authorization
* UI behavior
* business logic
* external integrations
* response formats

Type-safety improvements must not unintentionally change runtime behavior.

---

# 29. Generated Files

Do not manually modify generated files unless necessary.

If diagnostics originate from generated code:

1. Find the generator.
2. Determine whether generated files should be checked.
3. Fix the generator or configuration if appropriate.
4. Regenerate the files.

---

# 30. Before Declaring Success

Never claim the project is clean without validation.

For Python:

```text
Pyright/Pylance: verified
Tests: verified
Ruff: verified
```

For React:

```text
TypeScript: verified
ESLint: verified
Tests: verified
```

If something was not run, explicitly say:

```text
Not verified
```

Never fabricate results.

---

# 31. Final Report

After completing a task, report:

## Changes

What was actually changed.

## Root Causes

What caused the errors.

## Validation

Actual commands executed and results.

Example:

```text
Python
- Pyright: PASS
- Pytest: PASS
- Ruff: PASS

React
- TypeScript: PASS
- ESLint: PASS
- Tests: PASS
```

## Remaining Issues

If errors remain:

```text
File:
Line:
Diagnostic:
Root cause:
Recommended fix:
```

Do not claim completion if significant diagnostics remain.

---

# 32. Golden Rules

Always prefer:

```text
Correct code
```

over:

```text
Suppressed diagnostics
```

Prefer:

```text
Correct environment
```

over:

```text
Application-level workarounds
```

Prefer:

```text
Accurate types
```

over:

```text
any / Any
```

Prefer:

```text
Root-cause fixes
```

over:

```text
Symptom fixes
```

Prefer:

```text
Minimal changes
```

over:

```text
Unnecessary refactoring
```

The final objective is a maintainable full-stack application with:

* clean Python typing
* clean React/TypeScript typing
* correct API contracts
* correct dependency configuration
* passing tests
* clean linting
* reproducible development environments
* minimal technical debt
