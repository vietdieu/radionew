# CommuteCast Enterprise Guidelines & 10-Stage Sprint Lifecycle Framework

To ensure absolute system stability, zero side-effects, enterprise-grade scalability, and prevent regressions (such as "fixing RSS breaks Audio"), this project strictly enforces the **Sequential 10-Stage Sprint Lifecycle Framework**.

Every future sprint, task series, or software iteration must adhere to and document these ten stages sequentially before making and finalizing any codebase changes.

---

## 🔄 The 10-Stage Enterprise Sprint Lifecycle

```
Sprint X
① Discovery ──> ② Audit ──> ③ Architecture ──> ④ UX Design ──> ⑤ Implementation
                                                                      │
⑩ Freeze <── ⑨ Documentation <── ⑧ Performance <── ⑦ Manual QA <── ⑥ Automated Testing
```

### ① Discovery (Product Alignment)
- **Objective**: Establish product-centric justification and quantify business value before engineering begins.
- **Key Questions**:
  - **Why** are we building or modifying this feature? What user pain point does it solve?
  - **Scale**: How many users utilize this feature, and how frequently?
  - **Feasibility**: Is this change worth the engineering overhead and regression risks?
  - **KPIs**: What are the success metrics (e.g., Audio stream start time, RSS ingestion failure rate, UI latency)?

### ② Audit (Codebase Analysis)
- **Objective**: Conduct a comprehensive static analysis of the active codebase relative to the task.
- **Rules**:
  - Review files, dependencies, active environment properties, and existing architectural patterns.
  - Formulate a strict **Regression Map** identifying adjacent subsystems that might be affected (e.g., tweaking RSS schemas must explicitly test podcast generation and playback streams).

### ③ Architecture (Systems & State Design)
- **Objective**: Formulate the data models, contracts, and boundaries prior to any code execution.
- **Rules**:
  - Map data structures, network topologies, API endpoints, and client-side states.
  - Define state residences: React Context, local state, or centralized stores.
  - **Type Safety First**: Declare or update all relevant interfaces, type definitions, and schema structures in `/src/types.ts` before component files are updated.

### ④ UX Design (Interaction & Aesthetics)
- **Objective**: Define typography, micro-interactions, responsive states, and accessibility layouts.
- **Rules**:
  - Ensure touch targets are at least **44px** on all viewports.
  - Structure fluid responsive layouts supporting **Mobile, Tablet, Desktop, and Car Driving HUD**.
  - Detail visual transitions (using `motion/react`) and skeletal loaders for seamless asynchronous experiences.
  - Respect typography hierarchies (Inter for general body, display fonts for headings, and JetBrains Mono for data displays).

### ⑤ Implementation (Modular Coding)
- **Objective**: Deliver modular, highly targeted, clean, and self-documenting code updates.
- **Rules**:
  - Break tasks into non-interfering micro-updates to avoid large file bloat or compiler timeouts.
  - Use lazy initialization for resource-heavy components (e.g., AudioContext, WebSockets) to safeguard application startup.
  - Implement robust client-side error boundaries and safe server proxy paths.

### ⑥ Automated Testing (Continuous Integration)
- **Objective**: Programmatically validate code integrity and style rules.
- **Rules**:
  - Run `npm run lint` and `npm run build` after changes to guarantee there are no type errors, unused imports, or broken dependencies.
  - Validate package dependency lock-files to prevent runtime container boot failures.

### ⑦ Manual QA (Multi-Device & Network Checks)
- **Objective**: Verify interaction reliability and state stability under diverse environment conditions.
- **Rules**:
  - Test layouts and behaviors against target viewports: **Android, iPhone, Tablet, Desktop, and specialized Car HUD displays**.
  - Ensure full cross-browser compatibility across **Chrome, Edge, Firefox, and Safari**.
  - Simulate varying network speeds (throttled, offline mode) to verify offline PWA behavior, storage capacity limits, and background recovery.

### ⑧ Performance Optimization (Audit & Profiles)
- **Objective**: Profile resource footprints, render cycles, and potential memory leaks.
- **Rules**:
  - Audit Web Audio performance: Verify that all initialized `AudioContext` nodes and PCM players are explicitly closed and freed on component unmounts.
  - Profile React rendering loops to eliminate redundant state updates and infinite re-renders.
  - Check LocalStorage and database footprint thresholds.

### ⑨ Documentation (API & Knowledge Maps)
- **Objective**: Update schema documentation, inline guides, and system configuration logs.
- **Rules**:
  - Keep internal comments and markdown guides updated with the latest API changes, config values, and environment requirements.
  - Record major sprint accomplishments, schema adjustments, and bug fixes in a structured changelog.

### ⑩ Freeze Sprint (Release & Compliance)
- **Objective**: Securely freeze the verified version and declare release stability.
- **Rules**:
  - Compile the final application and test it in a production state.
  - Label and tag the finalized version appropriately (e.g., **CommuteCast 3.1 Release Candidate**).
  - transition the build into a production-ready locked state without letting experimental codes leak.

---

## 🛠️ Codebase Invariants & Guidelines

1. **Strict Client-Side/Server-Side Boundaries**: Keep API credentials and heavy text processing on the server-side proxy route `/api/*`. Never expose keys to client-side bundles.
2. **Audio Performance Preservation**: The Audio Synthesis and Manual PCM Player are core assets. Do not modify PCM stream players or audio contexts without performing full device and memory leak regression tests first.
3. **Typography**: Use standard fonts paired via Tailwind. Keep interface displays clean, literal, and clutter-free (No tech-larping status indicators).
