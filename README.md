# ArchGuard

> **Architecture Intelligence Platform** for TypeScript/JavaScript projects.  
> Detect structural decay, quantify technical debt, and prevent architectural erosion before it becomes expensive.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)](https://www.typescriptlang.org/)

---

## 🎯 What is ArchGuard?

**ArchGuard is NOT a linter.** Use ESLint for code style. Use Prettier for formatting.

ArchGuard is an **Architecture Intelligence Platform** that analyzes your codebase for structural and design problems that impact maintainability, scalability, and team velocity.

### Who is this for?

**👨‍💼 Engineering Managers & Tech Leads**
- Get objective metrics on code quality and technical debt
- Make data-driven decisions about refactoring priorities
- Track architecture health over time
- Justify technical investments to stakeholders

**👨‍💻 Senior Engineers & Architects**
- Enforce architectural boundaries automatically
- Prevent common design anti-patterns
- Identify coupling and complexity hotspots
- Guide refactoring efforts with concrete data

**👥 Development Teams**
- Catch architectural issues before code review
- Learn best practices through actionable feedback
- Maintain consistent code quality
- Reduce merge conflicts and technical debt

### What problems does it solve?

- 🏗️ **Structural decay** - Circular dependencies, layer violations, forbidden imports
- 🎨 **Design issues** - Excessive coupling, shotgun surgery, data clumps
- 🧠 **Complexity problems** - High cyclomatic complexity, deep nesting, large functions
- 🧹 **Code hygiene** - Duplicate code, unused exports, max file lines

---

## 🚀 Quick Start

### Installation

```bash
# Run instantly via npx (recommended - no installation needed)
npx @barbozaa/archguard

# Or install globally
npm install -g @barbozaa/archguard

# Or add to your project as dev dependency
npm install --save-dev @barbozaa/archguard
```

### Basic Usage

```bash
# Analyze current directory with default terminal output
archguard

# Analyze specific directory
archguard ./src

# Get executive summary (best for managers/leads)
archguard --format executive

# Output JSON for CI/CD pipelines
archguard --format json

# Fail CI if violations exist
archguard --fail-on-error

# Analyze with custom config
archguard --config ./my-config.json
```

### Understanding the Outputs

ArchGuard provides **three output formats** to suit different audiences:

#### 📊 Terminal Report (Default)
Full technical details for developers. Includes:
- Complete violation list with file locations
- Category-based organization
- Severity indicators
- Suggested fixes
- Architecture health score breakdown

**Best for:** Daily development, debugging, detailed analysis

```bash
archguard
# or
archguard --format terminal
```

#### 🎯 Executive Report
Condensed high-level view for leadership and decision-makers. Focuses on:
- Overall health score and status
- Top critical issues only
- Risk assessment
- Recommended next actions with effort estimates
- Score improvement projections

**Best for:** Sprint planning, leadership updates, refactoring prioritization

```bash
archguard --format executive
```

#### 🤖 JSON Report
Machine-readable structured output for automation. Includes:
- Complete violation data
- Scores and metrics
- File paths and line numbers
- Metadata for tracking

**Best for:** CI/CD integration, custom tooling, trend analysis

```bash
archguard --format json > report.json
```

---

## 📋 Architecture Rules

ArchGuard analyzes your codebase using **13 specialized rules** organized into 4 priority categories. Each rule is designed to catch specific architectural and design problems that impact maintainability, scalability, and team velocity.

### Rule Categories & Priority

| Category | Rules | Focus | Penalty Weight |
|----------|-------|-------|----------------|
| 🏗️ **Structural** | 3 rules | Critical architectural issues | **1.2x** (Highest) |
| 🎨 **Design** | 4 rules | Coupling and design smells | **1.0x** (High) |
| 🧠 **Complexity** | 4 rules | Code complexity and maintainability | **0.8x** (Medium) |
| 🧹 **Hygiene** | 2 rules | Code cleanliness | **0.5x** (Low) |

---

### 🏗️ STRUCTURAL RULES (Critical - Fix First)

These rules detect fundamental architectural problems that **block scalability** and cause **system-wide issues**. Fix these before they spread.

---

#### 1. Circular Dependencies

**What it detects:**  
Dependency cycles between modules where Module A imports Module B, which imports Module A (directly or indirectly).

**Why it matters:**
- 🚫 **Prevents independent deployment** - Can't deploy one module without the other
- 🧪 **Makes testing impossible** - Can't mock dependencies in circular loops
- 🐛 **Causes runtime errors** - Initialization race conditions and undefined exports
- 🔄 **Blocks refactoring** - Can't improve one module without touching all others
- 📦 **Breaks tree-shaking** - Bundle tools can't remove unused code

**Real-world example:**
```typescript
// ❌ BAD: Circular dependency
// auth/authService.ts
import { getUserById } from '../user/userService';

export function authenticate(userId: string) {
  const user = getUserById(userId); // Uses user service
  return user ? generateToken(user) : null;
}

// user/userService.ts  
import { authenticate } from '../auth/authService';

export function getUserById(id: string) {
  // ... fetch user
  authenticate(user.id); // Uses auth service ⚠️ CIRCULAR!
  return user;
}
```

**How to fix:**
```typescript
// ✅ GOOD: Extract shared interface
// shared/interfaces.ts
export interface IAuthService {
  authenticate(userId: string): Token | null;
}

// auth/authService.ts - no imports from user
export class AuthService implements IAuthService {
  authenticate(userId: string) { /* ... */ }
}

// user/userService.ts - depends on abstraction
import { IAuthService } from '../shared/interfaces';

export class UserService {
  constructor(private auth: IAuthService) {}
  
  getUserById(id: string) {
    // Uses injected auth service
    this.auth.authenticate(id);
  }
}
```

**Configuration:**
```json
{
  "rules": {
    "circular-deps": {
      "enabled": true
    }
  }
}
```

**Business impact:** 🚨 **CRITICAL** - Prevents system growth and increases bug density

**Typical effort to fix:** 2-8 hours per cycle (depending on complexity)

---

#### 2. Layer Violations

**What it detects:**  
Imports that violate architectural layer boundaries (e.g., UI layer directly importing from Infrastructure layer, bypassing Application layer).

**Why it matters:**
- 🏗️ **Violates separation of concerns** - Mixes responsibilities across layers
- 🔗 **Creates tight coupling** - Can't change one layer without breaking others
- 🧪 **Prevents proper testing** - Can't test UI without database connection
- 🔄 **Makes migrations impossible** - Can't swap database or UI framework easily
- 📚 **Confuses team** - Unclear architectural boundaries lead to inconsistent patterns

**Common layer hierarchies:**
```
Presentation (UI)
    ↓ (can use)
Application (Use Cases)
    ↓ (can use)
Domain (Business Logic)
    ↓ (can use)
Infrastructure (DB, APIs, etc)

⚠️ Lower layers should NEVER import from higher layers
```

**Real-world example:**
```typescript
// ❌ BAD: UI directly accessing database
// src/ui/components/UserProfile.tsx
import { database } from '../../infrastructure/database/client';

function UserProfile({ userId }: Props) {
  const user = database.users.findById(userId); // Direct DB access!
  return <div>{user.name}</div>;
}

// ❌ BAD: Domain importing from UI
// src/domain/user/User.ts
import { showNotification } from '../../ui/notifications'; // Domain depends on UI!

class User {
  updateEmail(email: string) {
    this.email = email;
    showNotification('Email updated'); // Domain calling UI!
  }
}
```

**How to fix:**
```typescript
// ✅ GOOD: Proper layering with dependency inversion
// src/ui/components/UserProfile.tsx
import { useUserById } from '../../application/user/queries';

function UserProfile({ userId }: Props) {
  const user = useUserById(userId); // Uses application layer
  return <div>{user.name}</div>;
}

// src/application/user/queries.ts
import { IUserRepository } from '../../domain/user/IUserRepository';

export class UserQueries {
  constructor(private userRepo: IUserRepository) {}
  
  getUserById(id: string) {
    return this.userRepo.findById(id); // Uses interface
  }
}

// src/infrastructure/database/UserRepository.ts
import { IUserRepository } from '../../domain/user/IUserRepository';

export class UserRepository implements IUserRepository {
  findById(id: string) {
    return database.users.findById(id); // Implementation detail
  }
}
```

**Configuration:**
```json
{
  "rules": {
    "layerRules": {
      "ui": ["application", "domain"],
      "application": ["domain"],  
      "domain": [],
      "infrastructure": ["domain"]
    }
  }
}
```

**Business impact:** 🚨 **CRITICAL** - Creates brittle architecture that's expensive to change

**Typical effort to fix:** 4-16 hours per violation (requires restructuring)

---

#### 3. Forbidden Imports

**What it detects:**  
Imports that match user-defined forbidden patterns (e.g., test code in production, deprecated packages, specific cross-module dependencies).

**Why it matters:**
- 🔒 **Enforces architectural decisions** - Codifies team agreements into automated checks
- 🚫 **Prevents bad dependencies** - Blocks problematic or deprecated packages
- 🧪 **Keeps test code isolated** - Prevents test utilities leaking into production bundles
- 📦 **Reduces bundle size** - Blocks heavy dependencies in frontend code
- 🛡️ **Security compliance** - Blocks insecure or deprecated packages
- 🏗️ **Maintains boundaries** - Enforces module isolation and feature boundaries

**Real-world examples:**
```typescript
// ❌ BAD: Test utilities in production code
// src/api/userController.ts
import { mockUser } from '../test/fixtures/users'; // Test code in production!

export function getUser(id: string) {
  return id === 'test' ? mockUser : realFetch(id);
}

// ❌ BAD: Importing from parent directories (tight coupling)
// src/features/auth/login.ts
import { config } from '../../../config'; // Reaches too far up!

// ❌ BAD: Heavy library in frontend when lighter alternative exists
// src/ui/components/DatePicker.tsx
import moment from 'moment'; // 67KB uncompressed! Use date-fns instead
```

**How to fix:**
```typescript
// ✅ GOOD: Use production-appropriate dependencies
// src/api/userController.ts
import { fetchUser } from './userRepository';

export function getUser(id: string) {
  return fetchUser(id); // Real implementation only
}

// ✅ GOOD: Proper dependency injection
// src/features/auth/login.ts
import { Config } from './types'; // Feature-local types

export class LoginService {
  constructor(private config: Config) {} // Injected dependency
}

// ✅ GOOD: Lightweight alternative
// src/ui/components/DatePicker.tsx
import { format, parseISO } from 'date-fns'; // Only 15KB!
```

**Configuration examples:**
```json
{
  "rules": {
    "forbiddenImports": [
      {
        "pattern": "**/*.test.*",
        "from": "src/production/**",
        "reason": "Test code should not be imported in production"
      },
      {
        "pattern": "moment",
        "from": "src/ui/**",
        "reason": "Use date-fns instead (smaller bundle)"
      },
      {
        "pattern": "../../../*",
        "from": "src/features/**",
        "reason": "Features should not reach outside their boundary"
      },
      {
        "pattern": "src/infrastructure/**",
        "from": "src/ui/**",
        "reason": "UI should not import infrastructure directly"
      }
    ]
  }
}
```

**Business impact:** 🟡 **HIGH** - Prevents technical debt accumulation and maintains clean boundaries

**Typical effort to fix:** 30 minutes - 2 hours per violation

---

### 🎨 DESIGN RULES (High Priority - Fix Soon)

These rules detect **coupling issues** and **design smells** that make code hard to change, test, and maintain.

---

#### 4. Too Many Imports

**What it detects:**  
Files with excessive import statements (default threshold: >15 imports).

**Why it matters:**
- 📊 **Violates Single Responsibility Principle** - File is doing too much
- 🔗 **High coupling** - Depends on too many other modules
- 🧪 **Testing difficulty** - Many dependencies to mock/stub
- 🧠 **Cognitive overload** - Hard to understand all dependencies
- 🔄 **Fragile to changes** - Any dependency change can break this file
- 📦 **Bundle bloat** - Pulls in large dependency graphs

**Real-world example:**
```typescript
// ❌ BAD: 23 imports! File is doing too much
// src/services/orderService.ts
import { User, UserRole, UserPermissions } from '../models/user';
import { Product, ProductCategory, ProductInventory } from '../models/product';
import { Order, OrderItem, OrderStatus } from '../models/order';
import { Payment, PaymentMethod, PaymentGateway } from '../payment';
import { Shipping, ShippingMethod, ShippingCalculator } from '../shipping';
import { Email, EmailTemplate, EmailService } from '../email';
import { Logger, LogLevel, LogFormatter } from '../logging';
import { Cache, CacheStrategy, CacheInvalidator } from '../cache';
import { Validator, ValidationRules, ValidationError } from '../validation';
import { Database, Transaction, QueryBuilder } from '../database';
import { Events, EventEmitter, EventHandler } from '../events';
import { Config, Environment, FeatureFlags } from '../config';
// ... handling user auth, products, payments, shipping, emails, logging, caching!
```

**How to fix:**
```typescript
// ✅ GOOD: Split into focused services
// src/services/orderCreationService.ts
import { Order, OrderItem } from '../models/order';
import { IPaymentService } from './interfaces';
import { IInventoryService } from './interfaces';

export class OrderCreationService {
  constructor(
    private payment: IPaymentService,
    private inventory: IInventoryService
  ) {}
  
  async createOrder(items: OrderItem[]): Promise<Order> {
    // Focused on order creation only
  }
}

// src/services/orderFulfillmentService.ts
import { Order } from '../models/order';
import { IShippingService } from './interfaces';
import { IEmailService } from './interfaces';

export class OrderFulfillmentService {
  // Handles shipping and notifications
}
```

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

**Business impact:** 🟡 **MEDIUM** - Increases maintenance burden and testing complexity

**Typical effort to fix:** 2-4 hours (requires splitting file into focused modules)

---

#### 5. Shotgun Surgery

**What it detects:**  
Symbols (classes, functions, types) that are used across many files (default threshold: 5+ files).

**Why it matters:**
- 💥 **Change amplification** - Single change requires touching many files
- 🐛 **High bug risk** - Easy to miss updates in some files
- 💸 **Expensive maintenance** - More time, more testing, more deployment risk
- 🔄 **Poor encapsulation** - Internals leaked across the codebase
- 🧪 **Difficult testing** - Changes affect many test suites
- ⚠️ **Coordination overhead** - Team members step on each other's toes

**Real-world example:**
```typescript
// ❌ BAD: UserConfig interface used in 12 different files
// src/config/types.ts
export interface UserConfig {
  theme: string;
  language: string;
  timezone: string;
  notifications: boolean;
}

// Used directly in:
// - src/ui/settings/ThemeSelector.tsx
// - src/ui/settings/LanguageSelector.tsx
// - src/ui/profile/UserProfile.tsx
// - src/api/userController.ts
// - src/services/userService.ts
// - src/services/notificationService.ts
// - src/middleware/authMiddleware.ts
// - src/database/userRepository.ts
// - src/validators/userValidator.ts
// - src/utils/userHelpers.ts
// ... and 2 more files

// Changing UserConfig requires updating all 12 files! 💥
```

**How to fix:**
```typescript
// ✅ GOOD: Introduce facade/adapter to centralize usage
// src/services/userPreferencesService.ts
export class UserPreferencesService {
  private config: UserConfig;
  
  getTheme(): string { return this.config.theme; }
  getLanguage(): string { return this.config.language; }
  getTimezone(): string { return this.config.timezone; }
  areNotificationsEnabled(): boolean { return this.config.notifications; }
  
  updateTheme(theme: string) { this.config.theme = theme; }
  // ... centralized access
}

// Now other files depend on the service interface, not the config directly
// src/ui/settings/ThemeSelector.tsx
import { UserPreferencesService } from '../../services/userPreferencesService';

function ThemeSelector({ prefsService }: { prefsService: UserPreferencesService }) {
  const theme = prefsService.getTheme(); // Through facade
}
```

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

**Business impact:** 🚨 **HIGH** - Change amplification creates high bug risk and expensive maintenance

**Typical effort to fix:** 3-8 hours (requires introducing abstraction layer)

---

#### 6. Data Clumps

**What it detects:**  
Same group of parameters (3+ parameters) appearing together in multiple functions (default: 3+ occurrences).

**Why it matters:**
- 🧩 **Missing abstraction** - Parameters form a cohesive concept that deserves a type
- 🐛 **Error-prone** - Easy to pass parameters in wrong order or forget one
- 📝 **Duplicate code** - Same parameter list repeated everywhere
- 🔄 **Hard to refactor** - Need to update every function signature
- 🧪 **Testing complexity** - More combinations to test
- 📚 **Poor documentation** - Relationship between parameters is implicit

**Real-world example:**
```typescript
// ❌ BAD: Same 4 parameters appearing in 5+ functions
// src/services/reportService.ts
function createReport(
  userId: string,
  startDate: Date,
  endDate: Date,
  format: string
) { /* ... */ }

function validateReportDates(
  userId: string,
  startDate: Date,
  endDate: Date,
  format: string
) { /* ... */ }

function sendReport(
  userId: string,
  startDate: Date,
  endDate: Date,
  format: string
) { /* ... */ }

function saveReportPreferences(
  userId: string,
  startDate: Date,
  endDate: Date,
  format: string
) { /* ... */ }

function scheduleReport(
  userId: string,
  startDate: Date,
  endDate: Date,
  format: string
) { /* ... */ }
```

**How to fix:**
```typescript
// ✅ GOOD: Extract parameters into a cohesive type
// src/types/reportTypes.ts
export interface ReportRequest {
  userId: string;
  dateRange: {
    start: Date;
    end: Date;
  };
  format: 'pdf' | 'csv' | 'excel';
}

// src/services/reportService.ts
function createReport(request: ReportRequest) { /* ... */ }
function validateReportDates(request: ReportRequest) { /* ... */ }
function sendReport(request: ReportRequest) { /* ... */ }
function saveReportPreferences(request: ReportRequest) { /* ... */ }
function scheduleReport(request: ReportRequest) { /* ... */ }

// Benefits:
// 1. Single source of truth
// 2. Can't pass parameters in wrong order
// 3. Easy to add new fields (e.g., timezone)
// 4. Self-documenting
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

**Business impact:** 🟡 **MEDIUM** - Reduces code quality and increases refactoring difficulty

**Typical effort to fix:** 1-3 hours (extract parameter object + update call sites)

---

#### 7. Long Parameter List

**What it detects:**  
Functions, methods, or constructors with too many parameters (default threshold: >4 parameters).

**Why it matters:**
- 🧠 **High cognitive load** - Hard to remember parameter order and meaning
- 🐛 **Error-prone** - Easy to pass wrong arguments or swap parameter order
- 🧪 **Testing complexity** - Exponential combinations (5 params = 120 permutations)
- 📝 **Poor readability** - Function calls are hard to understand
- 🔄 **Hard to extend** - Adding more parameters makes it worse
- 🏗️ **Missing abstraction** - Often indicates missing domain object

**Real-world example:**
```typescript
// ❌ BAD: 8 parameters! Hard to call correctly
// src/services/emailService.ts
function sendTransactionalEmail(
  recipientEmail: string,
  recipientName: string,
  subject: string,
  templateId: string,
  locale: string,
  sendAt: Date,
  trackOpens: boolean,
  attachments: File[]
) {
  // Which parameter is which? Easy to mix up!
}

// Calling this is a nightmare:
sendTransactionalEmail(
  'user@example.com',
  'John Doe',
  'Welcome!',
  'welcome-template',
  'en-US',
  new Date(),
  true,
  []
); // Is that order correct? 🤔
```

**How to fix:**
```typescript
// ✅ GOOD: Use parameter object pattern
// src/types/emailTypes.ts
interface EmailRecipient {
  email: string;
  name: string;
}

interface EmailContent {
  subject: string;
  templateId: string;
  locale: string;
}

interface EmailOptions {
  sendAt?: Date;
  trackOpens?: boolean;
  attachments?: File[];
}

interface TransactionalEmailRequest {
  recipient: EmailRecipient;
  content: EmailContent;
  options?: EmailOptions;
}

// src/services/emailService.ts
function sendTransactionalEmail(request: TransactionalEmailRequest) {
  const { recipient, content, options = {} } = request;
  // Clear structure, self-documenting
}

// Much clearer call site:
sendTransactionalEmail({
  recipient: {
    email: 'user@example.com',
    name: 'John Doe'
  },
  content: {
    subject: 'Welcome!',
    templateId: 'welcome-template',
    locale: 'en-US'
  },
  options: {
    trackOpens: true
  }
}); // Self-documenting! ✅
```

**Configuration:**
```json
{
  "rules": {
    "long-parameter-list": {
      "maxParameters": 4
    }
  }
}
```

**Severity levels:**
- **>6 parameters:** 🚨 CRITICAL — Urgent refactoring needed
- **5-6 parameters:** ⚠️ WARNING — Should refactor soon
- **>4 parameters:** ℹ️ INFO — Consider refactoring

**Business impact:** 🟡 **MEDIUM** - Reduces developer productivity and increases bug risk

**Typical effort to fix:** 1-2 hours (extract parameter object + update callers)

---

### 🧠 COMPLEXITY RULES (Medium Priority)

These detect cognitive load and maintainability issues that slow down development.

---

#### 8. Cyclomatic Complexity

**What it detects:**  
Functions with high cyclomatic complexity (default threshold: >10 decision points).

**Formula:** Complexity = 1 + (number of decision points)  
**Decision points:** if, for, while, case, catch, &&, ||, ??

**Why it matters:**
- 💥 **Exponentially increases bug probability** - Complexity 15 = 215 possible paths (32,768!)
- 🧪 **Impossible to test thoroughly** - Can't cover all paths
- 🧠 **Extreme cognitive load** - Can't fit entire function in head
- 🐛 **Bug magnet** - Complex code breeds bugs
- 🔄 **Hard to modify** - Any change risks breaking unexpected paths
- 📈 **Technical debt accumulator** - Gets worse over time

**Real-world example:**
```typescript
// ❌ BAD: Complexity = 18 (way too high!)
// src/services/orderProcessor.ts
function processOrder(order: Order): ProcessResult {
  if (order.items.length === 0) {  // +1
    return { error: 'Empty order' };
  }
  
  if (order.isPaid) {  // +1
    if (order.isShipped) {  // +1
      if (order.hasTracking) {  // +1
        for (const item of order.items) {  // +1
          if (item.requiresSignature) {  // +1
            if (!order.signature) {  // +1
              return { error: 'Signature required' };
            }
          }
          
          if (item.isFragile && !order.hasInsurance) {  // +2
            return { error: 'Insurance required' };
          }
          
          for (const warranty of item.warranties) {  // +1
            if (warranty.isExpired) {  // +1
              if (warranty.autoRenew && order.customer.allowAutoRenew) {  // +2
                renewWarranty(warranty);
              } else if (warranty.isCritical) {  // +1
                notifyCustomer(order.customer);
              }
            }
          }
        }
      } else {  // else doesn't add complexity, but the nested ifs do
        if (order.shippingMethod === 'express') {  // +1
          return { error: 'Tracking required for express' };
        }
      }
    } else if (order.requiresCustoms && !order.customsInfo) {  // +2
      return { error: 'Customs info required' };
    }
  }
  
  return { success: true };
}
// Complexity = 18! Nearly impossible to test all paths 💥
```

**How to fix:**
```typescript
// ✅ GOOD: Break down into focused functions
// src/services/orderProcessor.ts
function processOrder(order: Order): ProcessResult {
  const validation = validateOrder(order);
  if (!validation.isValid) return validation;
  
  if (order.isPaid && order.isShipped) {
    return processShippedOrder(order);
  }
  
  if (order.isPaid && !order.isShipped) {
    return processPendingShipment(order);
  }
  
  return { success: true };
}

// Each function has complexity < 5
function validateOrder(order: Order): ProcessResult {
  if (order.items.length === 0) {
    return { error: 'Empty order' };
  }
  return { isValid: true };
}

function processShippedOrder(order: Order): ProcessResult {
  if (!hasRequiredTracking(order)) {
    return { error: 'Tracking required' };
  }
  
  const signatureCheck = validateSignatures(order);
  if (!signatureCheck.isValid) return signatureCheck;
  
  const insuranceCheck = validateInsurance(order);
  if (!insuranceCheck.isValid) return insuranceCheck;
  
  processWarranties(order);
  return { success: true };
}

function hasRequiredTracking(order: Order): boolean {
  return order.hasTracking || order.shippingMethod !== 'express';
}

function validateSignatures(order: Order): ProcessResult {
  const needsSignature = order.items.some(item => item.requiresSignature);
  if (needsSignature && !order.signature) {
    return { error: 'Signature required' };
  }
  return { isValid: true };
}

// Each function is now simple, testable, and understandable ✅
```

**Configuration:**
```json
{
  "rules": {
    "cyclomatic-complexity": {
      "maxComplexity": 10
    }
  }
}
```

**Severity levels:**
- **>20:** 🚨 CRITICAL — Refactor immediately
- **15-19:** ⚠️ WARNING — Should refactor soon
- **10-14:** ℹ️ INFO — Consider refactoring

**Business impact:** 🚨 **HIGH** - Dramatically increases bug density and testing costs

**Typical effort to fix:** 3-8 hours per function (requires careful extraction)

---

#### 9. Deep Nesting

**What it detects:**  
Code with nesting depth >3 levels (if/for/while/try/switch statements).

**Why it matters:**
- 🧠 **High cognitive load** - Hard to track context across many nesting levels
- 📖 **Poor readability** - Code scrolls off screen horizontally
- 🐛 **Error-prone** - Easy to miss edge cases in deep branches
- 🧪 **Hard to test** - Deep nesting often correlates with high cyclomatic complexity
- 🔄 **Difficult to refactor** - Extracting logic is challenging
- ❓ **Unclear intent** - Business logic obscured by structure

**Real-world example:**
```typescript
// ❌ BAD: 6 levels deep! 😱
// src/services/paymentProcessor.ts
function processPayment(payment: Payment): Result {
  if (payment.isValid) {  // Level 1
    if (payment.amount > 0) {  // Level 2
      if (payment.method === 'credit_card') {  // Level 3
        for (const transaction of payment.transactions) {  // Level 4
          if (transaction.status === 'pending') {  // Level 5
            if (transaction.amount <= payment.limit) {  // Level 6
              // Business logic buried 6 levels deep!
              chargeCard(transaction);
            } else {
              throw new Error('Exceeds limit');
            }
          }
        }
      } else if (payment.method === 'paypal') {
        // More deep nesting...
      }
    } else {
      throw new Error('Invalid amount');
    }
  } else {
    throw new Error('Invalid payment');
  }
}
```

**How to fix:**
```typescript
// ✅ GOOD: Flatten with early returns and extraction
// src/services/paymentProcessor.ts
function processPayment(payment: Payment): Result {
  // Guard clauses - early returns reduce nesting
  if (!payment.isValid) {
    throw new Error('Invalid payment');
  }
  
  if (payment.amount <= 0) {
    throw new Error('Invalid amount');
  }
  
  // Delegate to specialized handlers
  switch (payment.method) {
    case 'credit_card':
      return processCreditCard(payment);
    case 'paypal':
      return processPayPal(payment);
    default:
      throw new Error('Unsupported payment method');
  }
}

// Extracted, focused function
function processCreditCard(payment: Payment): Result {
  const pendingTransactions = payment.transactions
    .filter(t => t.status === 'pending')
    .filter(t => t.amount <= payment.limit);
  
  // Flat structure, clear intent
  for (const transaction of pendingTransactions) {
    chargeCard(transaction);
  }
  
  return { success: true };
}

// Benefits:
// - Maximum nesting: 2 levels
// - Clear business logic
// - Easy to test each path
// - Self-documenting
```

**Alternative techniques:**
```typescript
// ✅ Array methods reduce nesting
// Instead of:
for (const user of users) {
  if (user.isActive) {
    if (user.hasPermission('admin')) {
      // do something
    }
  }
}

// Use:
users
  .filter(user => user.isActive)
  .filter(user => user.hasPermission('admin'))
  .forEach(user => {
    // do something
  });

// ✅ Extract complex conditions
// Instead of:
if (user && user.isActive && user.age >= 18 && user.hasVerifiedEmail) {
  // ...
}

// Use:
function isEligibleUser(user: User | null): boolean {
  return user?.isActive && user.age >= 18 && user.hasVerifiedEmail;
}

if (isEligibleUser(user)) {
  // ...
}
```

**Configuration:**
```json
{
  "rules": {
    "deep-nesting": {
      "maxDepth": 3
    }
  }
}
```

**Severity levels:**
- **>5 levels:** 🚨 CRITICAL — Refactor immediately (3-5h effort)
- **4-5 levels:** ⚠️ WARNING — Should refactor soon (2-3h effort)
- **>3 levels:** ℹ️ INFO — Consider refactoring (1-2h effort)

**Business impact:** 🟡 **MEDIUM** - Reduces code quality and developer velocity

**Typical effort to fix:** 1-4 hours (use early returns, extract methods, flatten with array methods)

---

#### 10. Large Function

**What it detects:**  
Functions or methods exceeding 50 lines of code (configurable threshold).

**Why it matters:**
- 🎯 **Violates Single Responsibility Principle** - Function does too much
- 📖 **Hard to understand** - Can't grasp entire function at once
- 🧪 **Difficult to test** - Many responsibilities = many test cases
- 👀 **Code review nightmare** - Reviewers can't evaluate thoroughly
- 🔄 **Hard to reuse** - Logic is buried, can't extract what you need
- 🐛 **Higher bug density** - More code = more places for bugs to hide
- 🏃 **Slows onboarding** - New developers struggle to understand

**Real-world example:**
```typescript
// ❌ BAD: 120 lines! Does everything!
// src/services/userService.ts
function createUser(userData: UserInput): User {
  // Lines 1-15: Validate input
  if (!userData.email || !userData.email.includes('@')) {
    throw new Error('Invalid email');
  }
  if (!userData.password || userData.password.length < 8) {
    throw new Error('Password too short');
  }
  if (userData.age < 13) {
    throw new Error('Must be 13 or older');
  }
  // ... 10 more validation checks
  
  // Lines 16-35: Check for existing user
  const existingByEmail = await database.users.findByEmail(userData.email);
  if (existingByEmail) {
    throw new Error('Email already in use');
  }
  const existingByUsername = await database.users.findByUsername(userData.username);
  if (existingByUsername) {
    throw new Error('Username taken');
  }
  // ... more duplicate checks
  
  // Lines 36-60: Hash password and prepare data
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(userData.password, salt, 1000, 64, 'sha512').toString('hex');
  const userId = uuidv4();
  const now = new Date();
  // ... 20 more lines of data prep
  
  // Lines 61-80: Create database record
  const user = await database.users.create({
    id: userId,
    email: userData.email,
    // ... 15 more fields
  });
  
  // Lines 81-100: Send welcome email
  const emailTemplate = await loadTemplate('welcome');
  const personalizedEmail = emailTemplate.replace('{{name}}', user.name);
  await sendEmail({
    to: user.email,
    subject: 'Welcome!',
    body: personalizedEmail
  });
  // ... email sending logic
  
  // Lines 101-120: Create default preferences, send analytics event, etc.
  // ... doing way too much!
  
  return user;
}
```

**How to fix:**
```typescript
// ✅ GOOD: Break into focused functions
// src/services/userService.ts

// Main function is now clear and short (12 lines)
async function createUser(userData: UserInput): Promise<User> {
  validateUserInput(userData);
  await checkUserUniqueness(userData);
  
  const hashedPassword = hashPassword(userData.password);
  const user = await createUserRecord(userData, hashedPassword);
  
  await sendWelcomeEmail(user);
  await createDefaultPreferences(user.id);
  trackUserCreation(user);
  
  return user;
}

// Each extracted function is focused (8-15 lines each)
function validateUserInput(userData: UserInput): void {
  if (!userData.email?.includes('@')) {
    throw new Error('Invalid email');
  }
  if (!userData.password || userData.password.length < 8) {
    throw new Error('Password too short');
  }
  if (userData.age < 13) {
    throw new Error('Must be 13 or older');
  }
  // Focused validation logic
}

async function checkUserUniqueness(userData: UserInput): Promise<void> {
  const existingByEmail = await database.users.findByEmail(userData.email);
  if (existingByEmail) throw new Error('Email already in use');
  
  const existingByUsername = await database.users.findByUsername(userData.username);
  if (existingByUsername) throw new Error('Username taken');
}

function hashPassword(password: string): HashedPassword {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return { hash, salt };
}

// Each function:
// - Has a single, clear purpose
// - Is easy to test in isolation
// - Can be reused elsewhere
// - Is easy to understand and review
```

**Configuration:**
```json
{
  "rules": {
    "large-function": {
      "maxLines": 50
    }
  }
}
```

**Severity levels:**
- **>100 lines:** 🚨 CRITICAL — Severe maintainability issue
- **75-99 lines:** ⚠️ WARNING — Needs refactoring
- **50-74 lines:** ℹ️ INFO — Minor improvement opportunity

**Business impact:** 🟡 **MEDIUM** - Reduces maintainability and onboarding speed

**Typical effort to fix:** 2-6 hours (requires careful extraction to maintain behavior)

---

#### 11. Max File Lines

**What it detects:**  
Files exceeding the configured line count threshold (default: 500 lines).

**Why it matters:**
- 🎯 **Violates Single Responsibility at file level** - File does too much
- 🗂️ **Poor separation of concerns** - Multiple responsibilities mixed together
- 📖 **Hard to navigate** - Scrolling through hundreds of lines to find code
- 👀 **Difficult code reviews** - Can't review entire file effectively
- 🔀 **Merge conflict magnet** - More developers touching same large file
- 🏃 **Slows onboarding** - New developers overwhelmed by large files
- 📦 **Organizational smell** - Indicates missing module structure

**Real-world example:**
```typescript
// ❌ BAD: 1,247 lines in one file!
// src/services/userService.ts

// Lines 1-150: User CRUD operations
export class UserService {
  async createUser(data: UserInput) { /* ... */ }
  async updateUser(id: string, data: UserUpdate) { /* ... */ }
  async deleteUser(id: string) { /* ... */ }
  async getUserById(id: string) { /* ... */ }
  async getUserByEmail(email: string) { /* ... */ }
  // ... 20 more user CRUD methods
}

// Lines 151-300: Authentication logic
export class AuthenticationService {
  async login(credentials: Credentials) { /* ... */ }
  async logout(userId: string) { /* ... */ }
  async refreshToken(token: string) { /* ... */ }
  async resetPassword(email: string) { /* ... */ }
  // ... 15 more auth methods
}

// Lines 301-450: User preferences
export class UserPreferencesService {
  async getPreferences(userId: string) { /* ... */ }
  async updatePreferences(userId: string, prefs: Preferences) { /* ... */ }
  // ... preferences logic
}

// Lines 451-600: User notifications
export class NotificationService {
  async sendNotification(userId: string, message: Notification) { /* ... */ }
  // ... notification logic
}

// Lines 601-750: User analytics
export class UserAnalyticsService {
  async trackEvent(userId: string, event: Event) { /* ... */ }
  // ... analytics logic
}

// Lines 751-900: User validation
export function validateEmail(email: string) { /* ... */ }
export function validatePassword(password: string) { /* ... */ }
// ... 30 validation functions

// Lines 901-1050: User utilities
export function formatUserName(user: User) { /* ... */ }
export function calculateUserAge(birthDate: Date) { /* ... */ }
// ... 25 utility functions

// Lines 1051-1247: User constants and types
export const USER_ROLES = { /* ... */ };
export const USER_STATUSES = { /* ... */ };
export type UserRole = /* ... */;
export type UserStatus = /* ... */;
// ... 50 more types and constants

// This is actually MANY files pretending to be one! 💥
```

**How to fix:**
```typescript
// ✅ GOOD: Split into focused modules with clear boundaries
// src/users/
//   ├── index.ts (barrel export - 10 lines)
//   ├── types.ts (shared types - 45 lines)
//   ├── constants.ts (shared constants - 30 lines)
//   ├── services/
//   │   ├── userService.ts (CRUD only - 120 lines)
//   │   ├── authenticationService.ts (auth logic - 90 lines)
//   │   ├── preferencesService.ts (preferences - 65 lines)
//   │   ├── notificationService.ts (notifications - 80 lines)
//   │   └── analyticsService.ts (analytics - 70 lines)
//   ├── validators/
//   │   ├── emailValidator.ts (email validation - 35 lines)
//   │   ├── passwordValidator.ts (password validation - 40 lines)
//   │   └── userDataValidator.ts (user data - 55 lines)
//   └── utils/
//       ├── userFormatters.ts (formatting - 45 lines)
//       └── userCalculations.ts (calculations - 50 lines)

// src/users/index.ts (clean public API)
export { UserService } from './services/userService';
export { AuthenticationService } from './services/authenticationService';
export { UserPreferencesService } from './services/preferencesService';
export * from './types';
export * from './constants';

// Benefits:
// - Each file has clear, single responsibility
// - Easy to find specific functionality
// - Reduced merge conflicts (team works on different files)
// - Better code organization and discoverability
// - Easier testing (mock dependencies file by file)
// - Clearer ownership and accountability
```

**Configuration:**
```json
{
  "rules": {
    "maxFileLines": 500
  }
}
```

**Severity levels:**
- **>1000 lines:** 🚨 CRITICAL — Urgent refactoring needed
- **500-999 lines:** ⚠️ WARNING — Should refactor soon
- **<500 lines:** ✅ HEALTHY

**Business impact:** 🟡 **MEDIUM** - Impacts team collaboration and code organization

**Typical effort to fix:** 4-12 hours (requires careful module extraction and restructuring)

**Refactoring strategy:**
1. **Identify logical groups** - Look for classes, functions, types that belong together
2. **Create new focused files** - Extract each group to its own file
3. **Update imports** - Replace imports from large file with new file paths
4. **Create barrel export** - Add index.ts to maintain clean public API
5. **Test thoroughly** - Ensure no functionality broke during split

---

### 🧹 HYGIENE RULES (Low Priority)

These detect code cleanliness issues that should be addressed during normal development.

---

#### 12. Duplicate Code

**What it detects:**  
Similar code blocks (5+ lines by default) appearing in multiple files.

**Why it matters:**
- 🔄 **Violates DRY Principle** - Same logic duplicated across codebase
- 🐛 **Inconsistent fixes** - Bug fixed in one place but not others
- 💸 **Higher maintenance cost** - Changes must be made multiple times
- 🧪 **Testing overhead** - Same logic tested multiple times
- 📝 **Documentation burden** - Must document same behavior multiple times
- ⚠️ **Drift risk** - Duplicates evolve differently over time

**Real-world example:**
```typescript
// ❌ BAD: Same email validation in 4 different files

// src/auth/registerController.ts
function register(email: string, password: string) {
  if (!email || !email.includes('@') || email.length < 5) {
    throw new Error('Invalid email format');
  }
  // ... registration logic
}

// src/profile/updateProfileController.ts
function updateEmail(userId: string, newEmail: string) {
  if (!newEmail || !newEmail.includes('@') || newEmail.length < 5) {
    throw new Error('Invalid email format');
  }
  // ... update logic
}

// src/admin/createUserController.ts
function createUser(userData: UserData) {
  if (!userData.email || !userData.email.includes('@') || userData.email.length < 5) {
    throw new Error('Invalid email format');
  }
  // ... creation logic
}

// src/newsletter/subscribeController.ts
function subscribe(email: string) {
  if (!email || !email.includes('@') || email.length < 5) {
    throw new Error('Invalid email format');
  }
  // ... subscription logic
}

// Problem: Bug fix in one place won't fix the others! 🐛
```

**How to fix:**
```typescript
// ✅ GOOD: Extract to shared utility
// src/utils/validators.ts
export function validateEmail(email: string): void {
  if (!email || !email.includes('@') || email.length < 5) {
    throw new Error('Invalid email format');
  }
  
  // Enhanced validation in one place
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new Error('Invalid email format');
  }
}

// Now all files use the shared validator
// src/auth/registerController.ts
import { validateEmail } from '../utils/validators';

function register(email: string, password: string) {
  validateEmail(email); // Single source of truth
  // ... registration logic
}

// Benefits:
// - Bug fixes apply everywhere automatically
// - Consistent validation across app
// - Easy to enhance (add more sophisticated regex)
// - Single test suite for validation
// - Clear location for validation logic
```

**More examples:**
```typescript
// ❌ BAD: Duplicate data transformation
// Multiple files do:
const formatted = {
  id: user.id,
  name: `${user.firstName} ${user.lastName}`,
  age: calculateAge(user.birthDate),
  status: user.isActive ? 'active' : 'inactive'
};

// ✅ GOOD: Extract transformer
// src/transformers/userTransformer.ts
export function formatUserForDisplay(user: User): DisplayUser {
  return {
    id: user.id,
    name: `${user.firstName} ${user.lastName}`,
    age: calculateAge(user.birthDate),
    status: user.isActive ? 'active' : 'inactive'
  };
}
```

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

**Severity levels:**
- **5+ files:** 🚨 CRITICAL — High duplication
- **3-4 files:** ⚠️ WARNING — Moderate duplication
- **2 files:** ℹ️ INFO — Minor duplication

**Business impact:** 🟢 **LOW-MEDIUM** - Increases maintenance cost over time

**Typical effort to fix:** 30 minutes - 2 hours (extract to shared function/class + update call sites)

**When NOT to fix:**
- **Test fixtures** - It's okay to duplicate test data
- **Configuration files** - Similar config blocks are normal
- **Generated code** - Don't refactor auto-generated code
- **Different contexts** - Similar code serving different purposes

---

#### 13. Unused Exports

**What it detects:**  
Exported functions, classes, or variables that are never imported anywhere in the project.

**Why it matters:**
- 🧹 **Dead code accumulation** - Increases codebase size unnecessarily
- 💸 **Maintenance burden** - Code must be maintained even if unused
- 📦 **Bundle bloat** - Unused exports may end up in production bundles
- 🤔 **Confusing API surface** - Developers unsure what's actually used
- ⚠️ **Incomplete refactoring** - Often indicates abandoned feature or incomplete cleanup
- 📚 **Documentation overhead** - Unused code must still be documented

**Real-world example:**
```typescript
// ❌ BAD: Many exports, but some are never imported

// src/utils/stringHelpers.ts
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
} // ✅ Used in 5 files

export function uppercase(str: string): string {
  return str.toUpperCase();
} // ❌ NEVER IMPORTED - use native .toUpperCase() instead

export function lowercase(str: string): string {
  return str.toLowerCase();
} // ❌ NEVER IMPORTED - use native .toLowerCase() instead

export function trim(str: string): string {
  return str.trim();
} // ❌ NEVER IMPORTED - use native .trim() instead

export function truncate(str: string, length: number): string {
  return str.length > length ? str.slice(0, length) + '...' : str;
} // ✅ Used in 3 files

export function slugify(str: string): string {
  return str.toLowerCase().replace(/\s+/g, '-');
} // ❌ NEVER IMPORTED - was part of abandoned feature

// Problem:
// - 4 out of 6 exports are unused
// - Developers think these are part of the API
// - Bundle includes dead code
// - Tests exist for unused code
```

**How to fix:**
```typescript
// ✅ GOOD: Only export what's actually used

// src/utils/stringHelpers.ts
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function truncate(str: string, length: number): string {
  return str.length > length ? str.slice(0, length) + '...' : str;
}

// uppercase, lowercase, trim removed - use native methods
// slugify removed - unused abandoned feature

// Benefits:
// - Clear, minimal public API
// - Less code to maintain
// - Smaller bundle size
// - Fewer tests to maintain
```

**Special cases:**
```typescript
// ✅ Public API / Library code (should be excluded from rule)
// src/public-api.ts
export { UserService } from './services/userService';
export { AuthService } from './services/authService';
// These are meant to be used by library consumers

// ✅ Type-only exports (excluded by default)
// src/types/user.ts
export interface User { /* ... */ }
export type UserRole = 'admin' | 'user';
// Interfaces and types are contracts, expected to be widely exported
```

**Configuration:**
```json
{
  "rules": {
    "unused-exports": {
      "excludePatterns": [
        "index.ts",
        "index.tsx",
        "public-api.ts",
        "api.ts",
        ".d.ts"
      ]
    }
  }
}
```

**Business impact:** 🟢 **LOW** - Code cleanliness and clarity

**Typical effort to fix:** 5-15 minutes per export (remove and verify tests still pass)

**When to keep unused exports:**
- **Public API files** - Meant for external consumption (add to excludePatterns)
- **Recently added** - May be used soon in upcoming feature
- **Documented as API** - Part of intentional public interface
- **Types/Interfaces** - Type contracts often exported preventively

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
