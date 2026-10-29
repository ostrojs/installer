# @ostro/installer — Antigravity AI Architecture & Knowledge Base

> **Package Name**: `@ostro/installer`
> **Version**: `2.0.0-alpha.1`
> **Role in Ecosystem**: Modular Core Framework Library

---

## 1. Package Purpose & Overview
Ostro CLI tool to scaffold new full-featured OstroJS web applications.

- **Primary Architectural Patterns**: CLI scaffolding, git clone / template extraction.
- **Key Exported Entities**: `NewCommand`

---

## 2. Dependencies & Interoperability
- **Direct Dependencies**:
  - `@ostro/console`: `^1.0.5`
  - `@ostro/support`: `^1.2.1`
- **Framework Consumers**: Consumed across the OstroJS ecosystem via `@ostro/framework` and direct imports.

---

## 3. Directory & Source Layout
```text
origin/installer/
├── index.ts
├── newCommand.ts
```

---

## 4. TypeScript Typing & Code Standards
1. **Access Modifiers**: All class properties and methods declare explicit visibility (`public`, `protected`, `private`).
2. **Inheritance & Overrides**: Classes overriding base class methods use the `override` keyword to safeguard contracts.
3. **Immutability**: Constant lookup tables and static registries use `readonly` and strict record types.
4. **No Implicit Any**: Public APIs avoid `any` in favor of generics (`<T = unknown>`) and typed contracts from `@ostro/contracts`.
5. **Contract Binding**: Core managers implement contracts from `@ostro/contracts/installer/*`.

6. **Ambient Class Field Declarations (`declare`)**:
   - In any class utilizing mixin traits (`implement(...)`), dynamic proxies (`Macroable`), or overriding parent getters/methods, class fields MUST be declared with `declare` (e.g., `declare public $guards: (string | null)[];`, `declare protected ...`, `declare private ...`).
   - **Rationale**: Prevents TypeScript (under standard ES class field semantics / `useDefineForClassFields: true`) from emitting `this.prop = void 0` assignments in constructors that overwrite and shadow inherited methods, getters, or prototype properties.
   - **Rule**: If a property is populated by a mixin or base class lifecycle, ALWAYS use:
     ```typescript
     declare public propertyName: PropertyType;
     declare protected propertyName: PropertyType;
     declare private propertyName: PropertyType;
     ```
7. **Direct Type Imports via `@ostro/*/typed`**:
   - Instead of defining duplicate local interfaces for framework components (such as `HttpContext`, `Request`, `Response`, `Model`, `Migration`, `Session`, `Validation`), applications and framework libraries MUST import types directly from `@ostro/foundation/typed` or `@ostro/<package>/typed`.

## 5. Development & Verification Guide
- **Compile / Build**: `npm run build` (runs `tsc -p tsconfig.build.json && chmod +x build/index.js`)
- **Run Tests**: `npm test` (executes Jest with 100% coverage target via `c8`)
- **Published Artifacts**: Target output compiled to `./build` with accompanying `.d.ts` declarations and source maps.

---
*Generated for Antigravity AI high-speed codebase comprehension with minimal token consumption.*

### Strict Type Narrowing & as any Elimination
- Replaced loose as any assertions with strict types (string, Error, Record<string, unknown>, constructor signatures, structural duck-typed interfaces, etc.).
- Prevented blind casting across core modules (support, foundation, database, server, router, pagination).
- Retained 100% test coverage across all 4 metrics (Statements, Branches, Functions, Lines).

## Architecture & Code Standards Review (Zero `as any`, node:* & @jest/globals)
- **Zero Loose Type Casting**: Replaced all occurrences of `as any` across both source code and test suites with strict type narrowing (e.g., concrete interfaces, structural duck-typed contracts, union types, Error, and typed constructor signatures).
- **Node Protocol Migration**: All Node.js built-in module imports and requires (`fs`, `path`, `http`, `crypto`, `os`, `stream`, `child_process`, `net`, etc.) have been fully migrated to explicit `node:*` protocol imports.
- **Direct Jest Runner & devDependencies**: Uses local `jest` directly installed in `devDependencies` without `npx` prefixes in `scripts`.
- **Jest Globals Modernization**: All test suites explicitly import test runner primitives (`describe`, `test`, `it`, `expect`, `beforeEach`, `afterEach`, `beforeAll`, `afterAll`, `jest`) directly from `@jest/globals`.
- **100% Test Coverage Target**: Fully maintained 100.00% unit test coverage across all four metrics: Statements (100%), Branches (100%), Functions (100%), and Lines (100%).
