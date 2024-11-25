import { initializeDB } from "./Config/Database";
import { initializeDevices } from "./Device/Device";
import { initializeScenes } from "./Device/SceneService";
import { initializeTriggers } from "./Device/TriggerService";
import { initializeHttpServer } from "./server";
import { initializeTuya } from "./Tuya/Client";
import { startWatchdog } from "./watchdog";

initializeDB();
initializeHttpServer();
await initializeDevices();
await initializeScenes();
await initializeTriggers();

try {
	// await initializeTuya();
} catch (e) {

}

startWatchdog();
