# ArchGuard

> **Architecture Intelligence Platform** for TypeScript/JavaScript projects.  
> Detect structural decay, quantify technical debt, and prevent architectural erosion before it becomes expensive.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)](https://www.typescriptlang.org/)

---

## 🎯 What is ArchGuard?

**ArchGuard is NOT a linter.** Use ESLint for code style.

ArchGuard is an **Architecture Intelligence Platform** that helps engineering teams:
- 🏗️ **Prevent architectural decay** before it becomes expensive
- 📊 **Quantify technical debt** with weighted health scores
- 🎯 **Surface critical issues** that block scalability
- 🛡️ **Enforce architectural boundaries** in CI/CD
- 💰 **Justify refactoring** with data-driven metrics

**Built for:** Staff+ Engineers, Engineering Managers, Technical Leads  
**Focus:** High signal, zero noise. Every violation matters. Every metric is actionable.

---

## 🚀 Quick Start

### Installation

```bash
# Run instantly via npx (no installation)
npx @barbozaa/archguard

# Or install globally
npm install -g @barbozaa/archguard

# Or add to your project
npm install --save-dev @barbozaa/archguard
```

### Basic Usage

```bash
# Analyze current directory
archguard

# Analyze specific directory
archguard ./src

# Output JSON for CI/CD
archguard --format json

# Executive summary for leadership
archguard --format executive
```

### CI/CD Integration

```yaml
# GitHub Actions example
- name: Architecture Analysis
  run: npx @barbozaa/archguard --format json > architecture-report.json
```

---

## 📊 Understanding the Output

ArchGuard provides three report formats:

### Terminal Report (Default)
Detailed technical view for developers with full violation details.

### Executive Report
Condensed view for leadership focusing on critical issues and score projections.

```bash
archguard --format executive
```

### JSON Report
Machine-readable output for CI/CD integration and custom tooling.

```bash
archguard --format json
```

---

## 🎓 Rules Reference

ArchGuard analyzes **14 architecture-focused rules** organized by category.

### 🏗️ STRUCTURAL RULES (Critical Priority)

These detect fundamental architectural problems that block scalability.

#### 1. Circular Dependencies
**What it detects:** Dependency cycles between modules (A → B → A)

**Why it matters:**
- Creates tight coupling that prevents independent deployment
- Makes code untestable (can't mock dependencies in cycles)
- Causes initialization race conditions and runtime errors
- Blocks incremental refactoring

**Example violation:**
```typescript
// auth.ts imports user.ts
import { User } from './user';

// user.ts imports auth.ts ❌ CIRCULAR!
import { authenticate } from './auth';
```

**Fix:**
- Introduce a shared abstraction layer
- Use dependency injection
- Extract shared logic to a separate module

**Business impact:** HIGH — Blocks team velocity, increases bug risk

---

#### 2. Layer Violations
**What it detects:** Imports that break architectural boundaries (e.g., UI → Database)

**Why it matters:**
- Violates separation of concerns
- Creates unwanted coupling between layers
- Makes system fragile and hard to change
- Prevents proper testing and mocking

**Example violation:**
```typescript
// ❌ UI layer importing from Infrastructure
// src/ui/UserProfile.tsx
import { database } from '../../infra/db/client';
```

**Fix:**
- Route through application/domain layer
- Use dependency inversion (interfaces)
- Respect layer hierarchy: UI → Application → Domain → Infrastructure

**Business impact:** HIGH — Technical debt, slower feature delivery

---

#### 3. Forbidden Imports
**What it detects:** User-configured import restrictions

**Why it matters:**
- Prevents test code leaking into production
- Enforces module boundaries
- Blocks unwanted dependencies
- Maintains architectural vision

**Example configuration:**
```json
{
  "rules": {
    "forbiddenImports": [
      { "pattern": "**/*.test", "from": "src/production/**" },
      { "pattern": "lodash", "from": "src/ui/**" }
    ]
  }
}
```

**Business impact:** MEDIUM — Prevents future problems

---

### 🎨 DESIGN RULES (High Priority)

These detect coupling and design smell issues.

#### 4. Too Many Imports
**What it detects:** Files with excessive dependencies (>15 imports)

**Why it matters:**
- Indicates violation of Single Responsibility Principle
- High coupling makes testing difficult
- Suggests file is doing too much
- Hard to understand and maintain

**Example violation:**
```typescript
// ❌ 20+ imports!
import { A, B, C } from 'lib1';
import { D, E, F } from 'lib2';
// ... 15 more imports
```

**Fix:**
- Break file into smaller, focused modules
- Use facade pattern to reduce direct dependencies
- Extract responsibilities into separate services

**Business impact:** MEDIUM — Maintenance burden, testing complexity

---

#### 5. Shotgun Surgery
**What it detects:** Changes requiring modifications across many files

**Why it matters:**
- Single change impacts 5+ files
- High risk of introducing bugs
- Expensive maintenance
- Poor encapsulation

**Example violation:**
```typescript
// Symbol 'UserConfig' used in 12 files
// Changing it requires updating all 12 ❌
```

**Fix:**
- Introduce facade or adapter pattern
- Centralize usage through dependency injection
- Extract shared behavior into base class

**Business impact:** HIGH — Change amplification, high bug risk

---

#### 6. Data Clumps
**What it detects:** Same group of parameters appearing in 3+ functions

**Why it matters:**
- Indicates missing abstraction
- Duplicate parameter lists are error-prone
- Hard to refactor
- Violates DRY principle

**Example violation:**
```typescript
// ❌ Same 3 parameters in multiple functions
function createUser(name: string, email: string, age: number) { }
function updateUser(name: string, email: string, age: number) { }
function validateUser(name: string, email: string, age: number) { }
```

**Fix:**
```typescript
// ✅ Extract to parameter object
interface UserData {
  name: string;
  email: string;
  age: number;
}

function createUser(data: UserData) { }
function updateUser(data: UserData) { }
```

**Business impact:** MEDIUM — Code quality, refactoring difficulty

---

#### 7. Long Parameter List
**What it detects:** Functions with >4 parameters

**Why it matters:**
- Hard to understand function purpose
- Difficult to test (many combinations)
- Often indicates missing abstraction
- Error-prone function calls

**Example violation:**
```typescript
// ❌ 7 parameters!
function createReport(
  userId: string,
  startDate: Date,
  endDate: Date,
  format: string,
  includeCharts: boolean,
  email: string,
  locale: string
) { }
```

**Fix:**
```typescript
// ✅ Use parameter object
interface ReportConfig {
  userId: string;
  dateRange: { start: Date; end: Date };
  format: string;
  options: { includeCharts: boolean };
  recipient: { email: string; locale: string };
}

function createReport(config: ReportConfig) { }
```

**Business impact:** MEDIUM — Developer productivity, bug risk

---

### 🧠 COMPLEXITY RULES (Medium Priority)

These detect cognitive load and maintainability issues.

#### 8. Cyclomatic Complexity
**What it detects:** Functions with >10 decision points (if/for/while/case)

**Why it matters:**
- Exponentially increases bug probability
- Extremely hard to test (2^n test cases)
- Difficult to understand and modify
- High cognitive load

**Example violation:**
```typescript
// ❌ Complexity: 15 (too high!)
function processOrder(order: Order) {
  if (order.isPaid) {
    if (order.isShipped) {
      if (order.hasTracking) {
        for (const item of order.items) {
          if (item.needsWarranty) {
            // ... 10 more decision points
          }
        }
      }
    }
  }
}
```

**Fix:**
- Break into smaller functions
- Use early returns/guard clauses
- Extract decision logic to helper methods
- Consider strategy pattern

**Business impact:** HIGH — Bug density, testing cost

---

#### 9. Deep Nesting
**What it detects:** Code nesting >3 levels deep

**Why it matters:**
- High cognitive load
- Hard to read and understand
- Often correlates with high complexity
- Makes testing difficult

**Example violation:**
```typescript
// ❌ 5 levels deep!
if (user) {
  if (user.isActive) {
    for (const order of user.orders) {
      if (order.isPending) {
        if (canProcess(order)) {
          // ... code here
        }
      }
    }
  }
}
```

**Fix:**
```typescript
// ✅ Flatten with early returns
if (!user?.isActive) return;

for (const order of user.orders) {
  if (!order.isPending || !canProcess(order)) continue;
  // ... code here
}
```

**Business impact:** MEDIUM — Code quality, developer velocity

---

#### 10. Large Function
**What it detects:** Functions exceeding 50 lines of code

**Why it matters:**
- Violates Single Responsibility Principle
- Hard to understand and test
- Difficult code reviews
- Often hides multiple responsibilities

**Fix:**
- Extract methods for distinct responsibilities
- Break into smaller, well-named functions
- Apply Extract Method refactoring

**Business impact:** MEDIUM — Maintainability, onboarding time

---

#### 11. Max File Lines
**What it detects:** Files exceeding 500 lines of code

**Why it matters:**
- Indicates poor separation of concerns
- Hard to navigate and understand
- Increased merge conflicts
- Violates SRP at file level

**Severity levels:**
- **500-999 lines:** ⚠️ WARNING — Should refactor
- **1000+ lines:** 🚨 CRITICAL — Urgent refactoring needed

**Fix:**
- Group related functionality into separate files
- Extract classes, utilities, and helpers
- Use barrel exports (index.ts) for organization

**Business impact:** MEDIUM — Team collaboration, merge conflicts

---

### 🧹 HYGIENE RULES (Low Priority)

These detect code cleanliness issues.

#### 12. Duplicate Code
**What it detects:** Similar code blocks appearing in 2+ files

**Why it matters:**
- Changes must be made in multiple places
- Increases bug risk (inconsistent fixes)
- Violates DRY principle
- Higher maintenance burden

**Example violation:**
```typescript
// ❌ Same validation logic in 3 files
// file1.ts
if (!email.includes('@')) throw new Error('Invalid email');

// file2.ts
if (!email.includes('@')) throw new Error('Invalid email');

// file3.ts
if (!email.includes('@')) throw new Error('Invalid email');
```

**Fix:**
```typescript
// ✅ Extract to shared utility
// utils/validation.ts
export function validateEmail(email: string) {
  if (!email.includes('@')) throw new Error('Invalid email');
}
```

**Business impact:** LOW-MEDIUM — Maintenance cost

---

#### 13. Unused Exports
**What it detects:** Exported declarations never imported anywhere

**Why it matters:**
- Dead code increases maintenance burden
- Confuses developers about public API
- May indicate incomplete refactoring
- Wastes bundle size

**Fix:**
- Remove truly unused exports
- Document if part of public API
- Add to exclusion patterns if intentional

**Business impact:** LOW — Code cleanliness

---

#### 14. Dead Code
**What it detects:** Unreachable code and unused variables

**Why it matters:**
- Wastes maintenance effort
- Confuses developers about active code paths
- May indicate incomplete refactoring
- Increases codebase size

**Example violation:**
```typescript
// ❌ Unreachable code after return
function process() {
  return result;
  console.log('Never runs!'); // Dead code
}
```

**Business impact:** LOW — Code quality

---

## ⚙️ Configuration

Create `archguard.config.json` in your project root:

```json
{
  "srcDirectory": "./src",
  "rules": {
    "maxFileLines": 500,
    "too-many-imports": {
      "maxImports": 15
    },
    "cyclomatic-complexity": {
      "maxComplexity": 10
    },
    "layerRules": {
      "ui": ["application", "domain"],
      "application": ["domain"],
      "domain": [],
      "infra": ["domain"]
    },
    "forbiddenImports": [
      {
        "pattern": "**/*.test.ts",
        "from": "src/production/**"
      }
    ]
  }
}
```

### Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| `srcDirectory` | `"."` | Root directory to analyze |
| `maxFileLines` | `500` | Maximum lines per file |
| `too-many-imports.maxImports` | `15` | Max import statements per file |
| `cyclomatic-complexity.maxComplexity` | `10` | Max cyclomatic complexity |
| `layerRules` | `{}` | Layer dependency rules |
| `forbiddenImports` | `[]` | Import restrictions |

---

## 📈 Scoring System

ArchGuard calculates an **Architecture Health Score (0-100)** using weighted penalties:

### Category Weights

| Category | Multiplier | Priority |
|----------|-----------|----------|
| 🏗️ **Structural** | 1.2x | CRITICAL — Blocks scalability |
| 🎨 **Design** | 1.0x | HIGH — Coupling issues |
| 🧠 **Complexity** | 0.8x | MEDIUM — Maintainability |
| 🧹 **Hygiene** | 0.5x | LOW — Code cleanliness |

### Score Interpretation

| Score | Status | Action Required |
|-------|--------|----------------|
| **90-100** | ✅ **Excellent** | Maintain standards |
| **75-89** | 💚 **Healthy** | Minor improvements |
| **60-74** | ⚠️ **Needs Attention** | Schedule refactoring |
| **0-59** | 🚨 **Critical** | Immediate action required |

### Score Normalization

Scores are **normalized by project size** to ensure fair comparison:
- Small projects (< 5K LOC): No normalization
- Medium projects (5K-50K LOC): 0.3 power factor
- Large projects (50K-200K LOC): 0.4 power factor
- Enterprise (> 200K LOC): 0.5 power factor

This prevents large projects from being unfairly penalized.

---

## 🎯 Use Cases

### For Engineering Teams
- **Pre-commit checks:** Prevent architectural violations before they merge
- **Code review:** Identify structural issues automatically
- **Refactoring:** Quantify improvement with before/after scores
- **Onboarding:** Help new developers understand architecture

### For Engineering Managers
- **Team health metrics:** Track architecture quality over time
- **Technical debt quantification:** Data-driven refactoring decisions
- **Risk assessment:** Identify high-risk areas before incidents
- **Justification:** Show ROI of architectural investments

### For Technical Leads
- **Boundary enforcement:** Automate architecture governance
- **Priority setting:** Focus on highest-impact violations
- **Mentoring:** Use violations as teaching moments
- **Standards:** Codify architectural decisions

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
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npx @barbozaa/archguard --format json > report.json
      - name: Upload Report
        uses: actions/upload-artifact@v3
        with:
          name: architecture-report
          path: report.json
```

### GitLab CI

```yaml
architecture-check:
  script:
    - npx @barbozaa/archguard --format json
  artifacts:
    reports:
      json: architecture-report.json
```

### Jenkins

```groovy
stage('Architecture Analysis') {
  steps {
    sh 'npx @barbozaa/archguard --format json > architecture-report.json'
    archiveArtifacts artifacts: 'architecture-report.json'
  }
}
```

---

## 📊 Example Reports

### Terminal Output
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ARCHGUARD — Analyzing my-project
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 EXECUTIVE SUMMARY
──────────────────────────────────────

  Architecture Score: 75 / 100  ███████░░░
  Health Status:      💚 Healthy
  Risk Level:         LOW
  Primary Concern:    None — architecture is healthy

  Category Breakdown:
    ✅ Structural:   0 issues    0 pts       LOW
    ⚠️  Design:       3 issues    -12.5 pts   MEDIUM
    ✅ Complexity:   0 issues    0 pts       LOW
    ✅ Hygiene:      2 issues    -3.2 pts    LOW
```

### Executive Format
```bash
archguard --format executive
```
```
┌─────────────────────────────────────────────────┐
│  ARCHITECTURE HEALTH SCORE: 75 / 100  [GOOD]   │
│  Status: 💚 Healthy                             │
│  Risk Breakdown:                                │
│    ⚠️  Design: 3 issues  -12.5 pts  MEDIUM     │
└─────────────────────────────────────────────────┘

🎯 IMMEDIATE ACTIONS

  NEXT 2-4 WEEKS (High Priority):
  1. ☑ Refactor UserService (too many imports)
     Estimated effort: 2-3 hours
     Expected score impact: +5 points
```

---

## 🤝 Contributing

Contributions welcome! Please read our [Contributing Guide](CONTRIBUTING.md) first.

### Development Setup

```bash
# Clone repository
git clone https://github.com/barbozaa/archguard.git
cd archguard

# Install dependencies
npm install

# Run tests
npm test

# Build
npm run build

# Test locally
./bin/cli.js .
```

---

## 📝 License

MIT © [Your Name]

---

## 🙏 Acknowledgments

Built with:
- [ts-morph](https://github.com/dsherret/ts-morph) - TypeScript AST manipulation
- [cac](https://github.com/cacjs/cac) - CLI framework
- [picocolors](https://github.com/alexeyraspopov/picocolors) - Terminal colors

---

## 📚 Further Reading

- [Architecture Roadmap](ARCHITECTURE_ROADMAP.md) - Future development plans
- [Rules Audit Report](RULES_AUDIT_REPORT.md) - Detailed technical audit
- [Phase 2 Scoring](PHASE_2_CODE_AUDIT.md) - Weighted scoring implementation

---

**Made with ❤️ by engineers who care about architecture**

*"The difference between a good system and a great one is knowing what NOT to build."*
