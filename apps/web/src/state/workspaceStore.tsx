import {
  addAction,
  addEntity,
  addInteraction,
  addLanguage,
  addMediation,
  addRelationship,
  addTransformation,
  createLayer,
  removeEntity,
  removeMediation,
  validateLayers,
  type Entity,
  type EntityId,
  type Finding,
  type Layer,
  type LayerId,
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

export type ViewMode = "world" | "language" | "tau";

export interface WorkspaceState {
  activeProjectId: string;
  projectName: string;
  layers: Layer[];
  mediations: MediationNode[];
  positions: Record<EntityId, { x: number; y: number }>;
  view: ViewMode;
  selectedLayerId: LayerId | null;
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
  | { type: "ADD_LAYER"; name: string }
  | { type: "ADD_LANGUAGE"; layerId: LayerId; name: string }
  | { type: "ADD_ENTITY"; layerId: LayerId; languageId: LanguageId; name: string; position?: { x: number; y: number } }
  | { type: "SET_POSITION"; entityId: EntityId; position: { x: number; y: number } }
  | {
      type: "ADD_RELATIONSHIP";
      layerId: LayerId;
      languageId: LanguageId;
      entityId: EntityId;
      targetEntityId: EntityId;
      cardinality: [number, number];
      constraints?: RelationshipConstraint[];
    }
  | {
      type: "ADD_ACTION";
      layerId: LayerId;
      languageId: LanguageId;
      entityId: EntityId;
      name: string;
      inputTypes: EntityId[];
      outputType: EntityId;
      actionLanguageId?: LanguageId;
    }
  | {
      type: "ADD_INTERACTION";
      layerId: LayerId;
      name: string;
      inputLanguageId: LanguageId;
      outputLanguageId: LanguageId;
      inputEntityIds: EntityId[];
      outputEntityId: EntityId;
    }
  | {
      type: "ADD_TRANSFORMATION";
      layerId: LayerId;
      sourceLanguageId: LanguageId;
      targetLanguageId: LanguageId;
      entityMappings?: Transformation["entityMappings"];
    }
  | { type: "REMOVE_ENTITY"; layerId: LayerId; languageId: LanguageId; entityId: EntityId }
  | { type: "ADD_MEDIATION"; intentLayerId: LayerId; mediatorLayerId: LayerId; implementationLayerId: LayerId }
  | { type: "REMOVE_MEDIATION"; mediationId: string }
  | { type: "SET_VIEW"; view: ViewMode }
  | { type: "SELECT_LAYER"; layerId: LayerId | null }
  | { type: "SELECT_LANGUAGE"; languageId: LanguageId | null }
  | { type: "SELECT_ENTITY"; entityId: EntityId | null }
  | { type: "SELECT_MEDIATION"; mediationId: string | null }
  | { type: "SELECT_TRANSFORMATION"; transformationId: TransformationId | null };

function reducer(state: WorkspaceState, action: Action): WorkspaceState {
  switch (action.type) {
    case "LOADED":
      return { ...state, layers: action.project.layers, mediations: action.project.mediations, loaded: true };
    case "SWITCH_PROJECT":
      return {
        ...state,
        activeProjectId: action.projectId,
        projectName: action.name,
        layers: [],
        mediations: [],
        positions: {},
        view: "world",
        selectedLayerId: null,
        selectedLanguageId: null,
        selectedEntityId: null,
        selectedMediationId: null,
        selectedTransformationId: null,
        loaded: false,
      };
    case "NEW_PROJECT":
      return {
        ...state,
        activeProjectId: action.projectId,
        projectName: action.name,
        layers: [],
        mediations: [],
        positions: {},
        view: "world",
        selectedLayerId: null,
        selectedLanguageId: null,
        selectedEntityId: null,
        selectedMediationId: null,
        selectedTransformationId: null,
        loaded: true,
      };
    case "IMPORTED":
      return {
        ...state,
        activeProjectId: action.projectId,
        projectName: action.name,
        layers: action.project.layers,
        mediations: action.project.mediations,
        positions: {},
        view: "world",
        selectedLayerId: null,
        selectedLanguageId: null,
        selectedEntityId: null,
        selectedMediationId: null,
        selectedTransformationId: null,
        loaded: true,
      };
    case "ADD_LAYER": {
      const layer = createLayer(action.name);
      return { ...state, layers: [...state.layers, layer], selectedLayerId: layer.id };
    }
    case "ADD_LANGUAGE":
      return { ...state, layers: addLanguage(state.layers, action.layerId, action.name) };
    case "ADD_ENTITY": {
      const layers = addEntity(state.layers, action.layerId, action.languageId, action.name);
      const language = layers.find((l) => l.id === action.layerId)?.languages.get(action.languageId);
      const newEntity = language ? Array.from(language.entities.values()).at(-1) : undefined;
      const positions =
        newEntity && action.position
          ? { ...state.positions, [newEntity.id]: action.position }
          : state.positions;
      return { ...state, layers, positions };
    }
    case "SET_POSITION":
      return { ...state, positions: { ...state.positions, [action.entityId]: action.position } };
    case "ADD_RELATIONSHIP":
      return {
        ...state,
        layers: addRelationship(
          state.layers,
          action.layerId,
          action.languageId,
          action.entityId,
          action.targetEntityId,
          action.cardinality,
          action.constraints
        ),
      };
    case "ADD_ACTION":
      return {
        ...state,
        layers: addAction(
          state.layers,
          action.layerId,
          action.languageId,
          action.entityId,
          action.name,
          action.inputTypes,
          action.outputType,
          action.actionLanguageId
        ),
      };
    case "ADD_INTERACTION":
      return {
        ...state,
        layers: addInteraction(
          state.layers,
          action.layerId,
          action.name,
          action.inputLanguageId,
          action.outputLanguageId,
          action.inputEntityIds,
          action.outputEntityId
        ),
      };
    case "ADD_TRANSFORMATION":
      return {
        ...state,
        layers: addTransformation(
          state.layers,
          action.layerId,
          action.sourceLanguageId,
          action.targetLanguageId,
          action.entityMappings
        ),
      };
    case "REMOVE_ENTITY":
      return {
        ...state,
        layers: removeEntity(state.layers, action.layerId, action.languageId, action.entityId),
        selectedEntityId: state.selectedEntityId === action.entityId ? null : state.selectedEntityId,
      };
    case "ADD_MEDIATION":
      return {
        ...state,
        mediations: addMediation(
          state.mediations,
          action.intentLayerId,
          action.mediatorLayerId,
          action.implementationLayerId
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
    case "SELECT_LAYER":
      return {
        ...state,
        selectedLayerId: action.layerId,
        selectedLanguageId: null,
        selectedEntityId: null,
        view: action.layerId ? "language" : state.view,
      };
    case "SELECT_LANGUAGE":
      return { ...state, selectedLanguageId: action.languageId, selectedEntityId: null };
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
    layers: [],
    mediations: [],
    positions: {},
    view: "world",
    selectedLayerId: null,
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
  selectedLayer: Layer | null;
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
      const project = await transport.loadProject(projectId);
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
      void transport.saveProject(state.activeProjectId, { layers: state.layers, mediations: state.mediations });
      touchProject(state.activeProjectId);
    }, 400);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [state.layers, state.mediations, state.loaded, state.activeProjectId]);

  const findings = useMemo(() => validateLayers(state.layers), [state.layers]);

  const selectedLayer = useMemo(
    () => state.layers.find((l) => l.id === state.selectedLayerId) ?? null,
    [state.layers, state.selectedLayerId]
  );

  const selectedEntity = useMemo(() => {
    if (!selectedLayer || !state.selectedLanguageId || !state.selectedEntityId) return null;
    const language = selectedLayer.languages.get(state.selectedLanguageId);
    return language?.entities.get(state.selectedEntityId) ?? null;
  }, [selectedLayer, state.selectedLanguageId, state.selectedEntityId]);

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
    void transport.saveProject(projectId, { layers: [], mediations: [] });
  };

  const importProject = (name: string, project: Project) => {
    const projectId = newProjectId();
    registerProject(projectId, name);
    setActiveProjectId(projectId);
    dispatch({ type: "IMPORTED", projectId, name, project });
    void transport.saveProject(projectId, project);
  };

  const exportProject = () => {
    const json = JSON.stringify(serializeProject({ layers: state.layers, mediations: state.mediations }), null, 2);
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
      selectedLayer,
      selectedEntity,
      selectedMediation,
      projects,
      switchProject,
      createProject,
      importProject,
      exportProject,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state, findings, selectedLayer, selectedEntity, selectedMediation, projects]
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within a WorkspaceProvider");
  return ctx;
}
