import {
  addAction,
  addEntity,
  addInteraction,
  addLanguage,
  addRelationship,
  addTransformation,
  createLayer,
  removeEntity,
  validateLayers,
  type Entity,
  type EntityId,
  type Finding,
  type Layer,
  type LayerId,
  type LanguageId,
  type RelationshipConstraint,
  type Transformation,
} from "@save/engine";
import { BrowserStorageTransport } from "@save/transport";
import React, { createContext, useContext, useEffect, useMemo, useReducer, useRef } from "react";

const PROJECT_ID = "default";
const transport = new BrowserStorageTransport();

export interface WorkspaceState {
  layers: Layer[];
  selectedLayerId: LayerId | null;
  selectedLanguageId: LanguageId | null;
  selectedEntityId: EntityId | null;
  loaded: boolean;
}

type Action =
  | { type: "LOADED"; layers: Layer[] }
  | { type: "ADD_LAYER"; name: string }
  | { type: "ADD_LANGUAGE"; layerId: LayerId; name: string }
  | { type: "ADD_ENTITY"; layerId: LayerId; languageId: LanguageId; name: string }
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
  | { type: "SELECT_LAYER"; layerId: LayerId | null }
  | { type: "SELECT_LANGUAGE"; languageId: LanguageId | null }
  | { type: "SELECT_ENTITY"; entityId: EntityId | null };

function reducer(state: WorkspaceState, action: Action): WorkspaceState {
  switch (action.type) {
    case "LOADED":
      return { ...state, layers: action.layers, loaded: true };
    case "ADD_LAYER": {
      const layer = createLayer(action.name);
      return { ...state, layers: [...state.layers, layer], selectedLayerId: layer.id };
    }
    case "ADD_LANGUAGE":
      return { ...state, layers: addLanguage(state.layers, action.layerId, action.name) };
    case "ADD_ENTITY":
      return {
        ...state,
        layers: addEntity(state.layers, action.layerId, action.languageId, action.name),
      };
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
    case "SELECT_LAYER":
      return { ...state, selectedLayerId: action.layerId, selectedLanguageId: null, selectedEntityId: null };
    case "SELECT_LANGUAGE":
      return { ...state, selectedLanguageId: action.languageId, selectedEntityId: null };
    case "SELECT_ENTITY":
      return { ...state, selectedEntityId: action.entityId };
    default:
      return state;
  }
}

function initialState(): WorkspaceState {
  return {
    layers: [],
    selectedLayerId: null,
    selectedLanguageId: null,
    selectedEntityId: null,
    loaded: false,
  };
}

interface WorkspaceContextValue {
  state: WorkspaceState;
  dispatch: React.Dispatch<Action>;
  findings: Finding[];
  selectedLayer: Layer | null;
  selectedEntity: Entity | null;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    transport.init().then(async () => {
      const layers = await transport.loadProject(PROJECT_ID);
      if (!cancelled) dispatch({ type: "LOADED", layers });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!state.loaded) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void transport.saveProject(PROJECT_ID, state.layers);
    }, 400);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [state.layers, state.loaded]);

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

  const value = useMemo(
    () => ({ state, dispatch, findings, selectedLayer, selectedEntity }),
    [state, findings, selectedLayer, selectedEntity]
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within a WorkspaceProvider");
  return ctx;
}
