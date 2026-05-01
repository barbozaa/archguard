# ArchGuard + MCP Integration Guide (Architecture Observability Setup)

## Overview

This document describes how to evolve `@barbozaa/archguard` into a **useful architecture observability layer** and how to integrate it properly into an **MCP (Model Context Protocol)** system for TypeScript/Angular projects.

The goal is to move from:

> basic dependency analysis tool

to

> architecture intelligence + CI enforcement + LLM-assisted decision system

---

# 1. What ArchGuard is (practical framing)

ArchGuard in its current form is best understood as:

* AST-based dependency analyzer
* Architecture drift detector (heuristic)
* Lightweight CLI for code structure inspection

It is NOT yet:

* a full architecture governance system
* a strict enforcement engine
* a standardized industry tool

---

# 2. Key architectural improvements needed

## 2.1 Introduce a semantic architecture model

Instead of raw dependency graphs, introduce explicit domain concepts:

* Features (auth, payments, dashboard)
* Layers (domain, application, infra)
* Boundaries (allowed / forbidden dependencies)

### Example rule model

```ts
noDependency(from: "feature/auth", to: "feature/payments")
layerRule("domain", "cannot import infra")
```

---

## 2.2 Replace heuristics with policy-based rules

Current issue: many architecture tools rely on scoring heuristics.

Better approach:

* explicit rules
* deterministic evaluation
* explainable violations

### Output should always include:

* rule violated
* source module
* target module
* reason
* severity

---

## 2.3 Add architecture diffing (critical feature)

Instead of only analyzing current state:

Compare:

* base branch
* PR branch

Return:

* new violations introduced
* removed violations
* risk score delta

---

## 2.4 CI-first design

Tool must support:

* GitHub Actions / GitLab CI
* PR-level analysis
* configurable fail thresholds

Example:

```yaml
archguard:
  fail_on:
    - high_severity_violation
```

---

## 2.5 Scalability for monorepos (Angular/Nx)

Must support:

* Nx project graph compatibility
* lazy-loaded modules
* feature libraries separation
* large repo caching

---

# 3. MCP Integration Design

## 3.1 Why MCP is ideal for ArchGuard

MCP enables LLMs to call external tools dynamically.

ArchGuard fits perfectly as:

> a callable architecture analysis tool

---

## 3.2 MCP Tool Design (recommended)

### Tool: analyze_dependencies

```json
{
  "name": "analyze_dependencies",
  "input": {
    "project": "string"
  }
}
```

### Tool: get_architecture_violations

```json
{
  "name": "get_architecture_violations",
  "input": {
    "base": "string",
    "head": "string"
  }
}
```

### Tool: score_module_health

```json
{
  "name": "score_module_health",
  "input": {
    "module": "string"
  }
}
```

---

## 3.3 MCP Output Contract (IMPORTANT)

All outputs must be structured and deterministic.

### Example response

```json
{
  "violations": [
    {
      "type": "boundary_violation",
      "from": "feature/auth",
      "to": "feature/payments",
      "severity": "high",
      "reason": "direct import across feature boundary"
    }
  ],
  "score": 72,
  "risk_level": "medium"
}
```

---

## 3.4 MCP architecture pattern

Recommended flow:

LLM → MCP Tool → ArchGuard Engine → Normalized Output → LLM reasoning

---

## 3.5 What makes MCP version powerful

If implemented correctly:

* LLM can review PRs automatically
* LLM can explain architecture violations
* LLM can suggest refactors
* LLM can simulate impact of changes

---

# 4. What would make ArchGuard "excellent"

To become a top-tier tool, it needs:

## 4.1 Explainability layer

Every violation must answer:

* what broke
* why it matters
* how to fix it

## 4.2 Architecture knowledge model

Explicit representation of:

* domains
* features
* layers
* allowed flows

## 4.3 Diff-aware intelligence

Not just state analysis, but change analysis.

## 4.4 Plugin ecosystem

* Angular plugin
* React plugin
* Nx plugin
* ESLint integration

---

# 5. References (real-world foundations)

These are relevant concepts behind architecture tools like ArchGuard:

## 5.1 Software Architecture & Design

* Martin Fowler - "Refactoring" [https://martinfowler.com/books/refactoring.html](https://martinfowler.com/books/refactoring.html)
* Clean Architecture (Robert C. Martin)
* Hexagonal Architecture (Ports & Adapters)

## 5.2 Dependency Analysis & Graph Theory

* dependency-cruiser documentation
  [https://github.com/sverweij/dependency-cruiser](https://github.com/sverweij/dependency-cruiser)
* Nx Project Graph
  [https://nx.dev/concepts/mental-model](https://nx.dev/concepts/mental-model)

## 5.3 Architecture Fitness Functions

* Neal Ford / ThoughtWorks
  [https://www.thoughtworks.com/radar/techniques/fitness-functions](https://www.thoughtworks.com/radar/techniques/fitness-functions)

## 5.4 Architecture Evolution & Drift

* "Software Architecture Metrics and Technical Debt"
* IEEE papers on architectural decay / erosion

## 5.5 LLM + Tooling (MCP relevance)

* Model Context Protocol (MCP) specification
  [https://modelcontextprotocol.io](https://modelcontextprotocol.io)

---

# 6. Final recommendation

Current ArchGuard state:

> useful experimental architecture analyzer

With MCP + semantic layer:

> becomes a true architecture intelligence system

Without it:

> remains a helpful but limited dependency analysis tool

---

# Summary

The key transformation is:

FROM:

* dependency graph tool

TO:

* architecture policy engine + LLM-aware observability layer
