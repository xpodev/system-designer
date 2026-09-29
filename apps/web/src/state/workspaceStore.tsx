import {
  addAction,
  addEntity,
  addInteraction,
  addLanguage,
  addMediation,
  addRelationship,
  addTransformation,
  createDomain,
  createLanguage,
  referenceLanguage,
  removeAction,
  removeDomain,
  removeEntity,
  removeInteraction,
  removeLanguage,
  removeMediation,
  removeRelationship,
  removeTransformation,
  unreferenceLanguage,
  validateProject,
  type Domain,
  type DomainId,
  type Entity,
  type EntityId,
  type Finding,
  type Language,
  type LanguageId,
  type MediationNode,
  type Project,
  type RelationshipConstraint,
  type Transformation,
  type TransformationId,
} from "@save/engine";
import {
  BrowserStorageTransport,
  HttpStorageTransport,
  serializeProject,
  type IStorageTransport,
} from "@save/transport";
import React, { createContext, useContext, useEffect, useMemo, useReducer, useRef } from "react";
import {
  getActiveProjectId,
  listProjects,
  projectName as lookupProjectName,
  registerProject,
  setActiveProjectId,
  touchProject,
} from "./projectRegistry.js";

const DEFAULT_PROJECT_ID = "default";

function createTransport(): IStorageTransport {
  const serverUrl = import.meta.env.VITE_SAVE_SERVER_URL as string | undefined;
  if (serverUrl) return new HttpStorageTransport(serverUrl);
  return new BrowserStorageTransport();
}

const transport = createTransport();

function newProjectId(): string {
  return crypto.randomUUID();
}

function emptyProject(): Project {
  return { languages: new Map(), domains: [], mediations: [] };
}

/** A project saved before Domains referenced Languages (instead of owning
 *  them) has no top-level `languages`/`domains` — it has `layers`, each
 *  owning its own language map. There's no automatic migration for that
 *  shape; treat it as unreadable rather than crash trying to render it. */
function isCurrentShape(project: unknown): project is Project {
  return (
    typeof project === "object" &&
    project !== null &&
    project instanceof Map === false &&
    "languages" in project &&
    "domains" in project &&
    Array.isArray((project as Project).domains)
  );
}

export type ViewMode = "world" | "language" | "tau";

export interface WorkspaceState {
  activeProjectId: string;
  projectName: string;
  languages: Map<LanguageId, Language>;
  domains: Domain[];
  mediations: MediationNode[];
  positions: Record<EntityId, { x: number; y: number }>;
  view: ViewMode;
  selectedDomainId: DomainId | null;
  selectedLanguageId: LanguageId | null;
  selectedEntityId: EntityId | null;
  selectedMediationId: string | null;
  selectedTransformationId: TransformationId | null;
  loaded: boolean;
}

type Action =
  | { type: "LOADED"; project: Project }
  | { type: "SWITCH_PROJECT"; projectId: string; name: string }
  | { type: "NEW_PROJECT"; projectId: string; name: string }
  | { type: "IMPORTED"; projectId: string; name: string; project: Project }
  | { type: "ADD_DOMAIN"; name: string }
  | { type: "CREATE_LANGUAGE"; name: string }
  | { type: "ADD_LANGUAGE"; domainId: DomainId; name: string }
  | { type: "REFERENCE_LANGUAGE"; domainId: DomainId; languageId: LanguageId }
  | { type: "UNREFERENCE_LANGUAGE"; domainId: DomainId; languageId: LanguageId }
  | { type: "ADD_ENTITY"; languageId: LanguageId; name: string; position?: { x: number; y: number } }
  | { type: "SET_POSITION"; entityId: EntityId; position: { x: number; y: number } }
  | {
      type: "ADD_RELATIONSHIP";
      languageId: LanguageId;
      entityId: EntityId;
      targetEntityId: EntityId;
      cardinality: [number, number];
      constraints?: RelationshipConstraint[];
    }
  | {
      type: "ADD_ACTION";
      languageId: LanguageId;
      entityId: EntityId;
      name: string;
      inputTypes: EntityId[];
      outputType: EntityId;
      actionLanguageId?: LanguageId;
    }
  | {
      type: "ADD_INTERACTION";
      name: string;
      inputLanguageId: LanguageId;
      outputLanguageId: LanguageId;
      inputEntityIds: EntityId[];
      outputEntityId: EntityId;
    }
  | {
      type: "ADD_TRANSFORMATION";
      domainId: DomainId;
      sourceLanguageId: LanguageId;
      targetLanguageId: LanguageId;
      entityMappings?: Transformation["entityMappings"];
    }
  | { type: "REMOVE_ENTITY"; languageId: LanguageId; entityId: EntityId }
  | { type: "REMOVE_RELATIONSHIP"; languageId: LanguageId; entityId: EntityId; relationshipId: string }
  | { type: "REMOVE_ACTION"; languageId: LanguageId; entityId: EntityId; actionId: string }
  | { type: "REMOVE_INTERACTION"; languageId: LanguageId; interactionId: string }
  | { type: "REMOVE_TRANSFORMATION"; domainId: DomainId; transformationId: TransformationId }
  | { type: "REMOVE_DOMAIN"; domainId: DomainId }
  | { type: "REMOVE_LANGUAGE"; languageId: LanguageId }
  | { type: "ADD_MEDIATION"; intentDomainId: DomainId; mediatorDomainId: DomainId; implementationDomainId: DomainId }
  | { type: "REMOVE_MEDIATION"; mediationId: string }
  | { type: "SET_VIEW"; view: ViewMode }
  | { type: "SELECT_DOMAIN"; domainId: DomainId | null }
  | { type: "SELECT_LANGUAGE"; languageId: LanguageId | null }
  | { type: "SELECT_ENTITY"; entityId: EntityId | null }
  | { type: "SELECT_MEDIATION"; mediationId: string | null }
  | { type: "SELECT_TRANSFORMATION"; transformationId: TransformationId | null };

function resetSelections<T extends WorkspaceState>(state: T): T {
  return {
    ...state,
    selectedDomainId: null,
    selectedLanguageId: null,
    selectedEntityId: null,
    selectedMediationId: null,
    selectedTransformationId: null,
    view: "world",
  };
}

function reducer(state: WorkspaceState, action: Action): WorkspaceState {
  switch (action.type) {
    case "LOADED":
      return { ...state, languages: action.project.languages, domains: action.project.domains, mediations: action.project.mediations, loaded: true };
    case "SWITCH_PROJECT":
      return resetSelections({
        ...state,
        activeProjectId: action.projectId,
        projectName: action.name,
        languages: new Map(),
        domains: [],
        mediations: [],
        positions: {},
        loaded: false,
      });
    case "NEW_PROJECT":
      return resetSelections({
        ...state,
        activeProjectId: action.projectId,
        projectName: action.name,
        languages: new Map(),
        domains: [],
        mediations: [],
        positions: {},
        loaded: true,
      });
    case "IMPORTED":
      return resetSelections({
        ...state,
        activeProjectId: action.projectId,
        projectName: action.name,
        languages: action.project.languages,
        domains: action.project.domains,
        mediations: action.project.mediations,
        positions: {},
        loaded: true,
      });
    case "ADD_DOMAIN": {
      const domain = createDomain(action.name);
      return { ...state, domains: [...state.domains, domain], selectedDomainId: domain.id };
    }
    case "CREATE_LANGUAGE": {
      const before = state.languages;
      const project = createLanguage(
        { languages: state.languages, domains: state.domains, mediations: state.mediations },
        action.name
      );
      const newId = Array.from(project.languages.keys()).find((id) => !before.has(id));
      return {
        ...state,
        languages: project.languages,
        selectedLanguageId: newId ?? state.selectedLanguageId,
        selectedEntityId: null,
        view: "language",
      };
    }
    case "ADD_LANGUAGE": {
      const project = addLanguage(
        { languages: state.languages, domains: state.domains, mediations: state.mediations },
        action.domainId,
        action.name
      );
      return { ...state, languages: project.languages, domains: project.domains };
    }
    case "REFERENCE_LANGUAGE": {
      const project = referenceLanguage(
        { languages: state.languages, domains: state.domains, mediations: state.mediations },
        action.domainId,
        action.languageId
      );
      return { ...state, domains: project.domains };
    }
    case "UNREFERENCE_LANGUAGE": {
      const project = unreferenceLanguage(
        { languages: state.languages, domains: state.domains, mediations: state.mediations },
        action.domainId,
        action.languageId
      );
      return { ...state, domains: project.domains };
    }
    case "ADD_ENTITY": {
      const languages = addEntity(
        { languages: state.languages, domains: state.domains, mediations: state.mediations },
        action.languageId,
        action.name
      ).languages;
      const language = languages.get(action.languageId);
      const newEntity = language ? Array.from(language.entities.values()).at(-1) : undefined;
      const positions =
        newEntity && action.position
          ? { ...state.positions, [newEntity.id]: action.position }
          : state.positions;
      return { ...state, languages, positions };
    }
    case "SET_POSITION":
      return { ...state, positions: { ...state.positions, [action.entityId]: action.position } };
    case "ADD_RELATIONSHIP":
      return {
        ...state,
        languages: addRelationship(
          { languages: state.languages, domains: state.domains, mediations: state.mediations },
          action.languageId,
          action.entityId,
          action.targetEntityId,
          action.cardinality,
          action.constraints
        ).languages,
      };
    case "ADD_ACTION":
      return {
        ...state,
        languages: addAction(
          { languages: state.languages, domains: state.domains, mediations: state.mediations },
          action.languageId,
          action.entityId,
          action.name,
          action.inputTypes,
          action.outputType,
          action.actionLanguageId
        ).languages,
      };
    case "ADD_INTERACTION":
      return {
        ...state,
        languages: addInteraction(
          { languages: state.languages, domains: state.domains, mediations: state.mediations },
          action.name,
          action.inputLanguageId,
          action.outputLanguageId,
          action.inputEntityIds,
          action.outputEntityId
        ).languages,
      };
    case "ADD_TRANSFORMATION":
      return {
        ...state,
        domains: addTransformation(
          { languages: state.languages, domains: state.domains, mediations: state.mediations },
          action.domainId,
          action.sourceLanguageId,
          action.targetLanguageId,
          action.entityMappings
        ).domains,
      };
    case "REMOVE_ENTITY": {
      const project = removeEntity(
        { languages: state.languages, domains: state.domains, mediations: state.mediations },
        action.languageId,
        action.entityId
      );
      return {
        ...state,
        languages: project.languages,
        domains: project.domains,
        selectedEntityId: state.selectedEntityId === action.entityId ? null : state.selectedEntityId,
      };
    }
    case "REMOVE_RELATIONSHIP":
      return {
        ...state,
        languages: removeRelationship(
          { languages: state.languages, domains: state.domains, mediations: state.mediations },
          action.languageId,
          action.entityId,
          action.relationshipId
        ).languages,
      };
    case "REMOVE_ACTION":
      return {
        ...state,
        languages: removeAction(
          { languages: state.languages, domains: state.domains, mediations: state.mediations },
          action.languageId,
          action.entityId,
          action.actionId
        ).languages,
      };
    case "REMOVE_INTERACTION": {
      const project = removeInteraction(
        { languages: state.languages, domains: state.domains, mediations: state.mediations },
        action.languageId,
        action.interactionId
      );
      return { ...state, languages: project.languages, domains: project.domains };
    }
    case "REMOVE_TRANSFORMATION":
      return {
        ...state,
        domains: removeTransformation(
          { languages: state.languages, domains: state.domains, mediations: state.mediations },
          action.domainId,
          action.transformationId
        ).domains,
      };
    case "REMOVE_DOMAIN": {
      const project = removeDomain(
        { languages: state.languages, domains: state.domains, mediations: state.mediations },
        action.domainId
      );
      return {
        ...state,
        domains: project.domains,
        mediations: project.mediations,
        selectedDomainId: state.selectedDomainId === action.domainId ? null : state.selectedDomainId,
        selectedMediationId: null,
      };
    }
    case "REMOVE_LANGUAGE": {
      const project = removeLanguage(
        { languages: state.languages, domains: state.domains, mediations: state.mediations },
        action.languageId
      );
      return {
        ...state,
        languages: project.languages,
        domains: project.domains,
        selectedLanguageId: state.selectedLanguageId === action.languageId ? null : state.selectedLanguageId,
        selectedEntityId: state.selectedLanguageId === action.languageId ? null : state.selectedEntityId,
      };
    }
    case "ADD_MEDIATION":
      return {
        ...state,
        mediations: addMediation(
          state.mediations,
          action.intentDomainId,
          action.mediatorDomainId,
          action.implementationDomainId
        ),
      };
    case "REMOVE_MEDIATION":
      return {
        ...state,
        mediations: removeMediation(state.mediations, action.mediationId),
        selectedMediationId: state.selectedMediationId === action.mediationId ? null : state.selectedMediationId,
      };
    case "SET_VIEW":
      return { ...state, view: action.view };
    case "SELECT_DOMAIN":
      return {
        ...state,
        selectedDomainId: action.domainId,
        selectedLanguageId: null,
        selectedEntityId: null,
        view: action.domainId ? "language" : state.view,
      };
    case "SELECT_LANGUAGE":
      return {
        ...state,
        selectedLanguageId: action.languageId,
        selectedEntityId: null,
        view: action.languageId ? "language" : state.view,
      };
    case "SELECT_ENTITY":
      return { ...state, selectedEntityId: action.entityId };
    case "SELECT_MEDIATION":
      return { ...state, selectedMediationId: action.mediationId, view: action.mediationId ? "tau" : state.view };
    case "SELECT_TRANSFORMATION":
      return { ...state, selectedTransformationId: action.transformationId };
    default:
      return state;
  }
}

function initialState(): WorkspaceState {
  const activeProjectId = getActiveProjectId() ?? DEFAULT_PROJECT_ID;
  return {
    activeProjectId,
    projectName: lookupProjectName(activeProjectId),
    languages: new Map(),
    domains: [],
    mediations: [],
    positions: {},
    view: "world",
    selectedDomainId: null,
    selectedLanguageId: null,
    selectedEntityId: null,
    selectedMediationId: null,
    selectedTransformationId: null,
    loaded: false,
  };
}

interface WorkspaceContextValue {
  state: WorkspaceState;
  dispatch: React.Dispatch<Action>;
  findings: Finding[];
  selectedDomain: Domain | null;
  selectedLanguage: Language | null;
  selectedEntity: Entity | null;
  selectedMediation: MediationNode | null;
  projects: ReturnType<typeof listProjects>;
  switchProject: (projectId: string) => void;
  createProject: (name: string) => void;
  importProject: (name: string, project: Project) => void;
  exportProject: () => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // (Re)loads whenever the active project changes — including the very first
  // mount, which is just "switch into whatever was last active."
  useEffect(() => {
    let cancelled = false;
    const projectId = state.activeProjectId;

    if (listProjects().every((p) => p.id !== projectId)) {
      registerProject(projectId, state.projectName || projectId);
    }
    setActiveProjectId(projectId);

    transport.init().then(async () => {
      const loaded = await transport.loadProject(projectId);
      const project = isCurrentShape(loaded) ? loaded : emptyProject();
      if (!cancelled && state.activeProjectId === projectId) {
        dispatch({ type: "LOADED", project });
      }
    });

    return () => {
      cancelled = true;
    };
    // Only re-run when the active project actually changes; NEW_PROJECT and
    // IMPORTED already populate state directly and don't need a reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.activeProjectId]);

  useEffect(() => {
    if (!state.loaded) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void transport.saveProject(state.activeProjectId, {
        languages: state.languages,
        domains: state.domains,
        mediations: state.mediations,
      });
      touchProject(state.activeProjectId);
    }, 400);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [state.languages, state.domains, state.mediations, state.loaded, state.activeProjectId]);

  const findings = useMemo(
    () => validateProject({ languages: state.languages, domains: state.domains, mediations: state.mediations }),
    [state.languages, state.domains, state.mediations]
  );

  const selectedDomain = useMemo(
    () => state.domains.find((d) => d.id === state.selectedDomainId) ?? null,
    [state.domains, state.selectedDomainId]
  );

  const selectedLanguage = useMemo(
    () => (state.selectedLanguageId ? state.languages.get(state.selectedLanguageId) ?? null : null),
    [state.languages, state.selectedLanguageId]
  );

  const selectedEntity = useMemo(() => {
    if (!selectedLanguage || !state.selectedEntityId) return null;
    return selectedLanguage.entities.get(state.selectedEntityId) ?? null;
  }, [selectedLanguage, state.selectedEntityId]);

  const selectedMediation = useMemo(
    () => state.mediations.find((m) => m.id === state.selectedMediationId) ?? null,
    [state.mediations, state.selectedMediationId]
  );

  const projects = useMemo(() => listProjects(), [state.activeProjectId, state.loaded]);

  const switchProject = (projectId: string) => {
    dispatch({ type: "SWITCH_PROJECT", projectId, name: lookupProjectName(projectId) });
  };

  const createProject = (name: string) => {
    const projectId = newProjectId();
    registerProject(projectId, name);
    setActiveProjectId(projectId);
    dispatch({ type: "NEW_PROJECT", projectId, name });
    void transport.saveProject(projectId, emptyProject());
  };

  const importProject = (name: string, project: Project) => {
    const projectId = newProjectId();
    registerProject(projectId, name);
    setActiveProjectId(projectId);
    dispatch({ type: "IMPORTED", projectId, name, project });
    void transport.saveProject(projectId, project);
  };

  const exportProject = () => {
    const json = JSON.stringify(
      serializeProject({ languages: state.languages, domains: state.domains, mediations: state.mediations }),
      null,
      2
    );
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${state.projectName || state.activeProjectId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const value = useMemo(
    () => ({
      state,
      dispatch,
      findings,
      selectedDomain,
      selectedLanguage,
      selectedEntity,
      selectedMediation,
      projects,
      switchProject,
      createProject,
      importProject,
      exportProject,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, findings, selectedDomain, selectedLanguage, selectedEntity, selectedMediation, projects]
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within a WorkspaceProvider");
  return ctx;
}
