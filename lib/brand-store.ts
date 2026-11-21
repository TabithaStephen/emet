
"use client";

import { useSyncExternalStore } from "react";
import { DEMO_BRAND } from "@/lib/demo-data";
import type {
  ApprovedFact,
  BrandDocument,
  BrandProfile,
  ExtractedRule,
  ProhibitedClaim,
  TerminologyRule,
} from "@/lib/types";

/* ------------------------------------------------------------------ */
/* Multi-brand persistence                                              */
/* ------------------------------------------------------------------ */

const LEGACY_STORAGE_KEY = "emet.brand-profile.v1";
const WORKSPACE_STORAGE_KEY = "emet.brand-workspaces.v1";

export interface BrandWorkspace {
  id: string;
  brand: BrandProfile;
  savedAt: string | null;
}

export interface BrandState {
  brand: BrandProfile;
  savedAt: string | null;
  hydrated: boolean;

  /* Multi-brand fields */
  activeBrandId: string;
  workspaces: BrandWorkspace[];
}

const DEFAULT_BRAND_ID = "northwind-capital";

const SERVER_STATE: BrandState = {
  brand: DEMO_BRAND,
  savedAt: null,
  hydrated: false,
  activeBrandId: DEFAULT_BRAND_ID,
  workspaces: [
    {
      id: DEFAULT_BRAND_ID,
      brand: DEMO_BRAND,
      savedAt: null,
    },
  ],
};

let state: BrandState = SERVER_STATE;
let initialised = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function stamp(): string {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normaliseBrand(
  stored: Partial<BrandProfile> | undefined,
): BrandProfile {
  return {
    ...DEMO_BRAND,
    ...(stored ?? {}),
    identity: {
      ...DEMO_BRAND.identity,
      ...(stored?.identity ?? {}),
    },
    voice: {
      ...DEMO_BRAND.voice,
      ...(stored?.voice ?? {}),
    },
    terminology: Array.isArray(stored?.terminology)
      ? stored.terminology
      : DEMO_BRAND.terminology,
    messaging: {
      ...DEMO_BRAND.messaging,
      ...(stored?.messaging ?? {}),
    },
    prohibitedClaims: Array.isArray(stored?.prohibitedClaims)
      ? stored.prohibitedClaims
      : DEMO_BRAND.prohibitedClaims,
    approvedFacts: Array.isArray(stored?.approvedFacts)
      ? stored.approvedFacts
      : DEMO_BRAND.approvedFacts,
    importedRules: Array.isArray(stored?.importedRules)
      ? stored.importedRules
      : [],
    documents: Array.isArray(stored?.documents)
      ? stored.documents
      : [],
  };
}

/** Load persisted workspaces and migrate the legacy single-brand store. */
function ensureLoaded() {
  if (initialised) return;
  initialised = true;

  let workspaces: BrandWorkspace[] = [];
  let activeBrandId = DEFAULT_BRAND_ID;

  try {
    const rawWorkspaces = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);

    if (rawWorkspaces) {
      const parsed = JSON.parse(rawWorkspaces);

      if (
        Array.isArray(parsed?.workspaces) &&
        parsed.workspaces.length > 0
      ) {
        workspaces = parsed.workspaces.map(
          (workspace: Partial<BrandWorkspace>) => ({
            id:
              typeof workspace.id === "string"
                ? workspace.id
                : `brand-${Date.now()}`,
            brand: normaliseBrand(workspace.brand),
            savedAt: workspace.savedAt ?? null,
          }),
        );

        activeBrandId =
          typeof parsed.activeBrandId === "string"
            ? parsed.activeBrandId
            : workspaces[0].id;
      }
    }

    /* Migrate the existing Northwind profile if no workspace store exists. */
    if (workspaces.length === 0) {
      let existingBrand = DEMO_BRAND;

      const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);

      if (legacy) {
        existingBrand = normaliseBrand(
          JSON.parse(legacy) as Partial<BrandProfile>,
        );
      }

      workspaces = [
        {
          id: DEFAULT_BRAND_ID,
          brand: normaliseBrand(existingBrand),
          savedAt: legacy ? stamp() : null,
        },
      ];

      activeBrandId = DEFAULT_BRAND_ID;
    }
  } catch {
    workspaces = [
      {
        id: DEFAULT_BRAND_ID,
        brand: DEMO_BRAND,
        savedAt: null,
      },
    ];
    activeBrandId = DEFAULT_BRAND_ID;
  }

  if (!workspaces.some((workspace) => workspace.id === activeBrandId)) {
    activeBrandId = workspaces[0]?.id ?? DEFAULT_BRAND_ID;
  }

  const activeWorkspace =
    workspaces.find((workspace) => workspace.id === activeBrandId) ??
    workspaces[0];

  state = {
    brand: activeWorkspace.brand,
    savedAt: activeWorkspace.savedAt,
    hydrated: true,
    activeBrandId,
    workspaces,
  };

  persistWorkspaces();
}

function persistWorkspaces() {
  try {
    window.localStorage.setItem(
      WORKSPACE_STORAGE_KEY,
      JSON.stringify({
        activeBrandId: state.activeBrandId,
        workspaces: state.workspaces,
      }),
    );
  } catch {
    // The in-memory state remains usable if storage is unavailable.
  }
}

function subscribe(listener: () => void) {
  ensureLoaded();
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): BrandState {
  ensureLoaded();
  return state;
}

function getServerSnapshot(): BrandState {
  return SERVER_STATE;
}

/* ------------------------------------------------------------------ */
/* Brand management                                                    */
/* ------------------------------------------------------------------ */

/** Update the active workspace only. */
export function updateBrand(patch: Partial<BrandProfile>) {
  ensureLoaded();

  const brand = normaliseBrand({
    ...state.brand,
    ...patch,
  });

  const savedAt = stamp();

  const workspaces = state.workspaces.map((workspace) =>
    workspace.id === state.activeBrandId
      ? { ...workspace, brand, savedAt }
      : workspace,
  );

  state = {
    ...state,
    brand,
    savedAt,
    workspaces,
    hydrated: true,
  };

  persistWorkspaces();
  emit();
}

/** Switch to an existing brand workspace. */
export function switchBrand(brandId: string) {
  ensureLoaded();

  const workspace = state.workspaces.find(
    (item) => item.id === brandId,
  );

  if (!workspace || brandId === state.activeBrandId) return;

  previousBrand = null;

  state = {
    ...state,
    brand: workspace.brand,
    savedAt: workspace.savedAt,
    activeBrandId: workspace.id,
    hydrated: true,
  };

  persistWorkspaces();
  emit();
}

/** Create a clean brand profile without copying another brand's rules. */
export function createBrand(name: string): BrandWorkspace | null {
  ensureLoaded();

  const cleanBrand: BrandProfile = {
    ...DEMO_BRAND,
    identity: {
      name: name.trim(),
      tagline: "",
      mission: "",
      industry: "",
      audience: "",
    },
    voice: {
      personality: [],
      toneDo: "",
      toneAvoid: "",
      readingLevel: "",
    },
    terminology: [],
    messaging: {
      pillars: [],
      boilerplate: "",
    },
    prohibitedClaims: [],
    approvedFacts: [],
    importedRules: [],
    documents: [],
  };

  if (!name.trim()) return null;

  const id = `brand-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;

  const workspace: BrandWorkspace = {
    id,
    brand: cleanBrand,
    savedAt: null,
  };

  state = {
    ...state,
    brand: cleanBrand,
    savedAt: null,
    activeBrandId: id,
    workspaces: [...state.workspaces, workspace],
    hydrated: true,
  };

  previousBrand = null;
  persistWorkspaces();
  emit();

  return workspace;
}

/** Delete a workspace. The last remaining brand cannot be deleted. */
export function deleteBrand(brandId: string): boolean {
  ensureLoaded();

  if (state.workspaces.length <= 1) return false;

  const workspaces = state.workspaces.filter(
    (workspace) => workspace.id !== brandId,
  );

  if (workspaces.length === state.workspaces.length) return false;

  let activeBrandId = state.activeBrandId;

  if (activeBrandId === brandId) {
    activeBrandId = workspaces[0].id;
  }

  const activeWorkspace = workspaces.find(
    (workspace) => workspace.id === activeBrandId,
  )!;

  previousBrand = null;

  state = {
    ...state,
    workspaces,
    activeBrandId,
    brand: activeWorkspace.brand,
    savedAt: activeWorkspace.savedAt,
    hydrated: true,
  };

  persistWorkspaces();
  emit();

  return true;
}

/** Reset only the currently active profile to a clean state. */
export function resetBrand() {
  ensureLoaded();

  const resetProfile: BrandProfile = {
    ...state.brand,
    voice: {
      personality: [],
      toneDo: "",
      toneAvoid: "",
      readingLevel: "",
    },
    terminology: [],
    messaging: {
      pillars: [],
      boilerplate: "",
    },
    prohibitedClaims: [],
    approvedFacts: [],
    importedRules: [],
    documents: [],
  };

  updateBrand(resetProfile);
}

/* ------------------------------------------------------------------ */
/* Imported brand documents                                            */
/* ------------------------------------------------------------------ */

export const MAX_IMPORTED_RULES = 40;

let previousBrand: BrandProfile | null = null;
let previousBrandId: string | null = null;

export interface MergeOutcome {
  added: number;
  duplicates: number;
  overflow: number;
}

const norm = (value: string) => value.trim().toLowerCase();

/** Append accepted rules to the currently active workspace. */
export function mergeImportedRules(
  rules: ExtractedRule[],
  document: BrandDocument,
): MergeOutcome {
  ensureLoaded();

  previousBrand = state.brand;
  previousBrandId = state.activeBrandId;

  const terminology: TerminologyRule[] = [...state.brand.terminology];
  const prohibitedClaims: ProhibitedClaim[] = [
    ...state.brand.prohibitedClaims,
  ];
  const approvedFacts: ApprovedFact[] = [...state.brand.approvedFacts];
  const importedRules: ExtractedRule[] = [
    ...state.brand.importedRules,
  ];

  let added = 0;
  let duplicates = 0;
  let overflow = 0;

  for (const rule of rules) {
    const sourceDoc = document.name;

    if (rule.kind === "terminology" && rule.avoid && rule.prefer) {
      if (
        terminology.some(
          (t) => norm(t.avoid) === norm(rule.avoid!),
        )
      ) {
        duplicates++;
        continue;
      }

      terminology.push({
        id: rule.id,
        avoid: rule.avoid,
        prefer: rule.prefer,
        note: rule.summary,
        sourceDoc,
      });

      added++;
      continue;
    }

    if (rule.kind === "prohibited-claim") {
      if (
        prohibitedClaims.some(
          (claim) => norm(claim.phrase) === norm(rule.summary),
        )
      ) {
        duplicates++;
        continue;
      }

      prohibitedClaims.push({
        id: rule.id,
        phrase: rule.sourceQuote,
        reason: rule.summary,
        sourceDoc,
      });

      added++;
      continue;
    }

    if (rule.kind === "approved-fact") {
      if (
        approvedFacts.some(
          (fact) => norm(fact.statement) === norm(rule.summary),
        )
      ) {
        duplicates++;
        continue;
      }

      approvedFacts.push({
        id: rule.id,
        statement: rule.summary,
        source: `${sourceDoc}${rule.page ? `, p.${rule.page}` : ""}`,
        sourceDoc,
      });

      added++;
      continue;
    }

    if (
      importedRules.some(
        (existing) => norm(existing.summary) === norm(rule.summary),
      )
    ) {
      duplicates++;
      continue;
    }

    if (importedRules.length >= MAX_IMPORTED_RULES) {
      overflow++;
      continue;
    }

    importedRules.push({ ...rule, sourceDoc });
    added++;
  }

  updateBrand({
    terminology,
    prohibitedClaims,
    approvedFacts,
    importedRules,
    documents: [
      { ...document, acceptedRules: added },
      ...state.brand.documents,
    ].slice(0, 20),
  });

  return { added, duplicates, overflow };
}

/** Whether the most recent import can be undone. */
export function canUndoImport(): boolean {
  return previousBrand !== null;
}

/** Undo the most recent import, but only in the brand where it occurred. */
export function undoLastImport() {
  if (!previousBrand || previousBrandId !== state.activeBrandId) return;

  const restore = previousBrand;
  previousBrand = null;
  previousBrandId = null;

  updateBrand(restore);
}

export function removeImportedRule(id: string) {
  updateBrand({
    importedRules: state.brand.importedRules.filter(
      (rule) => rule.id !== id,
    ),
  });
}

/** Read the selected Brand DNA from any client component. */
export function useBrand(): BrandState {
  return useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
}
