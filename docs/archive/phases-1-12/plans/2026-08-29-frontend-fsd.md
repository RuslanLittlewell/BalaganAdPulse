# Frontend FSD Migration Plan

1. Create the FSD layer directories and move existing modules to their target slices.
2. Add public APIs for slices and replace cross-slice relative imports with aliases.
3. Keep tests colocated with their implementation and move shared test infrastructure.
4. Validate layer imports, run the production build, and run all frontend tests.
