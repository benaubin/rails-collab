import type { Node, Schema } from "prosemirror-model";
import { Mappable, Mapping } from "prosemirror-transform";
import type { PluginState } from "./plugin";
import type { EditorState } from "prosemirror-state";
import pluginKey from "./plugin-key";

interface Mapee<S extends Schema> {
  map(doc: Node<S>, mapping: Mappable): this;
}

export function mapBackToSyncedVersion<T extends Mapee<Schema>>(
  pluginState: PluginState,
  mapee: T
): T | false {
  const reverseUnsyncedMapping = new Mapping();
  reverseUnsyncedMapping.appendMappingInverted(pluginState.unsyncedMapping);

  try {
    return mapee.map(pluginState.lastSyncedDoc, reverseUnsyncedMapping);
  } catch (e) {
    if (e instanceof RangeError) {
      return false;
    } else throw e;
  }
}

export function mappingFromVersion<S extends Schema>(
  state: EditorState<S>,
  version: number
) {
  const pluginState = pluginKey.getState(state);
  let behind = pluginState.syncedVersion - version;

  if (behind < 0)
    // too early to get a mapping for this version
    return false;

  const mapping = new Mapping();

  for (; behind > 0; behind--)
    mapping.appendMapping(pluginState.versionMappings[behind]);

  mapping.appendMapping(pluginState.unsyncedMapping);

  return mapping;
}
