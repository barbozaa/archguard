export type RuleExplanationSlug =
  | 'layer-violation'
  | 'feature-boundary'
  | 'too-many-imports'
  | 'shotgun-surgery'
  | 'data-clumps'
  | 'duplicate-code';

export const RULE_EXPLANATIONS: Record<
  RuleExplanationSlug,
  { what: string; why: string; fix: string }
> = {
  'layer-violation': {
    what: 'A file imports from a layer it should not depend on, violating the configured architectural boundaries.',
    why: 'Layer violations break separation of concerns. They create tight coupling between layers, making it impossible to swap implementations (e.g. change database) without touching higher layers. They also prevent proper unit testing since you can\'t mock a layer that\'s bypassed.',
    fix: 'Route the dependency through the proper layer. If Presentation needs data, go through Application, not directly to Infrastructure. Use dependency inversion: depend on interfaces defined in inner layers, implemented in outer layers.',
  },
  'too-many-imports': {
    what: 'A file has more import statements than the configured threshold (default: 15).',
    why: 'High import count signals a file with too many responsibilities (SRP violation). It\'s tightly coupled to the rest of the codebase, fragile to changes, hard to test, and creates cognitive overload for developers reading it.',
    fix: 'Split the file into focused modules, each with a single responsibility. Extract cohesive groups of functionality into their own files. Use facade patterns to reduce the number of direct dependencies.',
  },
  'shotgun-surgery': {
    what: 'An exported symbol (function, class) is imported in many files (default: 5+), meaning any change to it forces updates across the codebase.',
    why: 'High fan-out creates change amplification: one modification requires touching many files, increasing regression risk and coordination overhead. It often indicates poor encapsulation — internals are leaking across module boundaries.',
    fix: 'Introduce a facade or service that centralizes access to the symbol. Downstream consumers depend on the facade instead, insulating them from changes to the underlying implementation.',
  },
  'data-clumps': {
    what: 'The same group of 3+ parameters appears together in multiple function signatures (default: 3+ occurrences).',
    why: 'Repeating parameter groups signal a missing abstraction. Those parameters form a cohesive concept that should be a type. Without it, parameters can be passed in wrong order, adding fields requires updating every signature, and the relationship between params is implicit.',
    fix: 'Extract the parameter group into an interface or class (Value Object pattern). Replace the individual parameters with a single typed object. This makes function signatures cleaner, self-documenting, and easier to extend.',
  },
  'duplicate-code': {
    what: 'Identical normalized code blocks (5+ lines) appear in multiple files.',
    why: 'Duplicated logic means bugs must be fixed in multiple places. Over time, copies drift apart, leading to inconsistent behavior. It increases maintenance cost and testing burden.',
    fix: 'Extract the duplicated logic into a shared function or utility module. Import it from all call sites. This creates a single source of truth that can be tested once and improved globally.',
  },
  'feature-boundary': {
    what: 'A file inside one feature boundary imports from another feature that is not listed in its allowImportsFrom configuration.',
    why: 'Feature isolation is critical for team autonomy and independent deployability. When feature/auth imports directly from feature/payments, changes to payments can break auth — forcing cross-team coordination, increasing regression risk, and making it impossible to extract features into separate packages or services later.',
    fix: 'Move shared logic to a common module (e.g. "features/shared") and add it to allowImportsFrom. If the dependency is intentional, explicitly allow it in archguard.config.json. For loose coupling, consider event-driven communication between features.',
  },
};
