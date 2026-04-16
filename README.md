# ArchGuard

> **Architecture Intelligence Platform** for TypeScript/JavaScript projects.  
> Detect structural decay, quantify coupling risk, and prevent architectural erosion before it becomes expensive.

[![npm version](https://img.shields.io/npm/v/@barbozaa/archguard)](https://www.npmjs.com/package/@barbozaa/archguard)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)](https://www.typescriptlang.org/)

---

## 🎯 What is ArchGuard?

**ArchGuard is NOT a linter.** Use ESLint for code style. Use Prettier for formatting.

ArchGuard detects **architectural and design problems** that ESLint cannot — cross-file coupling, layer violations, parameter group smells, and code duplication patterns. It focuses exclusively on issues that require whole-project analysis.

### Who is this for?

**👨‍💼 Engineering Managers & Tech Leads**
- Objective metrics on architecture quality and coupling risk
- Data-driven decisions about refactoring priorities
- Executive summary format for non-technical stakeholders

**👨‍💻 Senior Engineers & Architects**
- Enforce architectural boundaries automatically
- Identify coupling hotspots and design smells
- Guide refactoring with concrete, prioritized findings

**👥 Development Teams**
- Catch architectural issues before code review
- Learn from actionable, specific feedback
- CI/CD integration to block regressions

---

## 🚀 Quick Start

```bash
# Run instantly (no installation needed)
npx @barbozaa/archguard .

# Install globally
npm install -g @barbozaa/archguard

# Add as dev dependency
npm install --save-dev @barbozaa/archguard
```

```bash
# Standard terminal report
archguard .

# Executive summary (great for planning sessions)
archguard . --format executive

# JSON output for CI/CD pipelines
archguard . --format json

# Fail CI if any violations found
archguard . --fail-on-error

# Use custom config file
archguard . --config ./archguard.config.json
```

---

## 📋 Architecture Rules

ArchGuard analyzes your codebase with **5 specialized rules** in 3 categories. Every rule requires whole-project analysis — things ESLint cannot do.

| Category | Rules | Multiplier |
|----------|-------|-----------|
| 🏗️ **Structural** | Layer Violations | **1.2×** |
| 🎨 **Design** | Too Many Imports · Shotgun Surgery · Data Clumps | **1.0×** |
| 🧹 **Hygiene** | Duplicate Code | **0.5×** |

---

### 🏗️ Layer Violation — `critical`

Detects imports that violate configured architectural layer boundaries.

**Why it matters:** A UI file importing directly from infrastructure bypasses your application layer, creates tight coupling to implementation details, and makes the layer boundary meaningless.

```typescript
// ❌ BAD: Presentation layer importing Infrastructure directly
// src/presentation/UserProfile.tsx
import { database } from '../../infrastructure/database/client';

// ✅ GOOD: Go through Application layer
// src/presentation/UserProfile.tsx
import { getUserById } from '../../application/user/queries';
```

**Configuration:**
```json
{
  "rules": {
    "layerRules": {
      "presentation": ["application", "domain"],
      "application": ["domain"],
      "domain": [],
      "infrastructure": ["domain"]
    }
  }
}
```

> Layer detection is path-based. Layer names must match a directory segment (`presentation`, `application`, `domain`, `infrastructure`, `infra`, `ui`).

---

### 🎨 Too Many Imports — `warning`

Detects files with excessive import statements (default: >15).

**Why it matters:** High import count is a reliable signal that a file has too many responsibilities and is tightly coupled to the rest of the codebase.

| Count | Severity |
|-------|----------|
| > 25 | `critical` |
| > 15 | `warning` |

**Configuration:**
```json
{
  "rules": {
    "too-many-imports": {
      "maxImports": 15
    }
  }
}
```

---

### 🎨 Shotgun Surgery — `info` / `warning`

Detects exported symbols (classes, functions) used across many files (default: ≥5).

**Why it matters:** When a single symbol is imported in dozens of files, any change to it forces modifications across the codebase — high blast radius, high regression risk.

```typescript
// ❌ BAD: OrderConfig used directly in 12 files
// Changing it requires touching 12 files

// ✅ GOOD: Introduce a facade or service
export class OrderService {
  // Centralizes access — downstream files are insulated from changes
}
```

| File count | Severity |
|------------|----------|
| ≥ 10 | `warning` |
| ≥ 5 | `info` |

**Configuration:**
```json
{
  "rules": {
    "shotgun-surgery": {
      "minFiles": 5
    }
  }
}
```

> Interfaces, type aliases, and enums are excluded (type-only symbols don't cause runtime coupling). Utility modules (`/utils/`, `/helpers/`, `/shared/`) are also excluded.

---

### 🎨 Data Clumps — `warning`

Detects the same group of 3+ parameters appearing together in multiple functions (default: ≥3 occurrences).

**Why it matters:** Repeating parameter groups signal a missing abstraction — those parameters belong together in a type or class.

```typescript
// ❌ BAD: Same 3 params in 5 functions
function createReport(userId: string, startDate: Date, format: string) {}
function validateReport(userId: string, startDate: Date, format: string) {}
function sendReport(userId: string, startDate: Date, format: string) {}

// ✅ GOOD: Extract into a type
interface ReportRequest { userId: string; startDate: Date; format: string; }
function createReport(request: ReportRequest) {}
```

**Configuration:**
```json
{
  "rules": {
    "data-clumps": {
      "minOccurrences": 3
    }
  }
}
```

---

### 🧹 Duplicate Code — `info` / `warning` / `critical`

Detects identical code blocks (≥5 lines) appearing in multiple files.

**Why it matters:** Duplicated logic means bugs must be fixed in multiple places and behavior drifts over time.

| Files with duplicate | Severity |
|----------------------|----------|
| ≥ 5 files | `critical` |
| ≥ 3 files | `warning` |
| 2 files | `info` |

**Configuration:**
```json
{
  "rules": {
    "duplicate-code": {
      "minLines": 5
    }
  }
}
```

> Test files are excluded from duplicate detection. Boilerplate patterns (closing braces + return statements) are filtered out to reduce false positives.

---

## ⚙️ Configuration

Create `archguard.config.json` in your project root:

```json
{
  "srcDirectory": "./src",
  "rules": {
    "too-many-imports": {
      "maxImports": 15
    },
    "shotgun-surgery": {
      "minFiles": 5
    },
    "data-clumps": {
      "minOccurrences": 3
    },
    "duplicate-code": {
      "minLines": 5
    },
    "layerRules": {
      "presentation": ["application", "domain"],
      "application": ["domain"],
      "domain": [],
      "infrastructure": ["domain"]
    }
  }
}
```

| Option | Default | Description |
|--------|---------|-------------|
| `srcDirectory` | `"."` | Directory to analyze |
| `too-many-imports.maxImports` | `15` | Max import statements per file |
| `shotgun-surgery.minFiles` | `5` | Min files for a symbol to flag |
| `data-clumps.minOccurrences` | `3` | Min occurrences for a parameter group to flag |
| `duplicate-code.minLines` | `5` | Min lines for a duplicate block |
| `layerRules` | `{}` | Layer dependency rules |

---

## 📈 Scoring System

ArchGuard calculates an **Architecture Health Score (0–100)**.

### Formula

```
architecturePenalty = structural.penalty × 0.50 + design.penalty × 0.35
architectureScore   = 100 − normalize(architecturePenalty)

hygienePenalty      = hygiene.penalty
hygieneScore        = 100 − normalize(hygienePenalty)

score               = architectureScore × 0.8 + hygieneScore × 0.2
```

### Normalization by project size

Penalties are scaled down for larger projects to account for the fact that more code means proportionally more surface area for issues.

| Project size | Normalization |
|-------------|---------------|
| ≤ 5,000 LOC | None (penalty applied as-is) |
| 5k – 50k LOC | `penalty × (5000 / LOC)^0.3` |
| 50k – 200k LOC | `penalty × (5000 / LOC)^0.4` |
| > 200k LOC | `penalty × (5000 / LOC)^0.5` |

### Status thresholds

| Score | Status |
|-------|--------|
| 90–100 | ✨ Excellent |
| 75–89 | 💚 Healthy |
| 60–74 | ⚠️ Needs Attention |
| 0–59 | 🚨 Critical |

### Coupling metrics (informational)

In addition to the score, ArchGuard reports **Ca/Ce/Instability** (Robert Martin's package metrics):

- **Ca (Afferent Coupling)** — how many modules depend on this module
- **Ce (Efferent Coupling)** — how many modules this module depends on  
- **Instability I = Ce/(Ca+Ce)** — 0 = stable, 1 = unstable
- **Blast Radius** — top 5 modules by number of dependents

---

## 📊 Output Formats

### Terminal (default)

Full technical report for developers. Shows violation details, file locations, suggested fixes, and the full score breakdown.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ARCHGUARD — Analyzing my-project
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 EXECUTIVE SUMMARY

  Architecture Score: 82 / 100  ████████░░
  Health Status:      💚 Healthy
  Risk Level:         LOW
  Primary Concern:    Too Many Imports — 3 issues

  Category Breakdown:
    ℹ️  Structural:  0 issues    0 pts      LOW
    ⚠️  Design:      3 issues    -15.3 pts  MEDIUM
    ℹ️  Hygiene:     2 issues    -4.1 pts   LOW
```

### Executive (`--format executive`)

Condensed high-level view. Best for sprint planning, leadership updates, and refactoring prioritization.

### JSON (`--format json`)

Machine-readable structured output for CI/CD pipelines, custom tooling, and trend tracking.

```bash
archguard . --format json > architecture-report.json
```

---

## 🔌 CI/CD Integration

### GitHub Actions

```yaml
name: Architecture Check
on: [pull_request]

jobs:
  architecture:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npx @barbozaa/archguard . --fail-on-error
```

### Fail on critical only

```bash
# Only fail CI on critical violations (ignore info/warning)
npx @barbozaa/archguard . --format json | node -e "
  const r = require('fs').readFileSync('/dev/stdin','utf8');
  const data = JSON.parse(r);
  process.exit(data.violations.some(v => v.severity === 'critical') ? 1 : 0);
"
```

---

## 🤝 Contributing

```bash
git clone https://github.com/barbozaa/archguard.git
cd archguard
npm install
npm test
npm run build
node dist/cli.js .
```

Pull requests welcome. Please ensure `npm test` passes and `node dist/cli.js .` returns 100/100 before submitting.

---

## 📝 License

MIT © barbozaa

---

Built with [ts-morph](https://github.com/dsherret/ts-morph) · [cac](https://github.com/cacjs/cac) · [picocolors](https://github.com/alexeyraspopov/picocolors)
