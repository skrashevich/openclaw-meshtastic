import { createPluginRuntimeStore } from "openclaw/plugin-sdk/runtime-store";
import type { PluginRuntime } from "./runtime-api.js";

const {
  setRuntime: setMeshtasticRuntime,
  clearRuntime: clearStoredMeshtasticRuntime,
  getRuntime: getMeshtasticRuntime,
} = createPluginRuntimeStore<PluginRuntime>({
  pluginId: "meshtastic",
  errorMessage: "Meshtastic runtime not initialized",
});
export { getMeshtasticRuntime, setMeshtasticRuntime };
export function clearMeshtasticRuntime() {
  clearStoredMeshtasticRuntime();
}
