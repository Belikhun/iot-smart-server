import { initializeDB } from "./Config/Database";
import { initializeDevices } from "./Device/Device";
import { initializeScenes } from "./Device/SceneService";
import { initializeSchedules } from "./Device/ScheduleService";
import { initializeTriggers } from "./Device/TriggerService";
import { initializeFirebase } from "./Firebase/Client";
import { initializeHttpServer } from "./server";
import { initializeTuya } from "./Tuya/Client";
import { startWatchdog } from "./watchdog";

await initializeDB();
await initializeDevices();
await initializeScenes();
await initializeTriggers();
await initializeSchedules();
initializeFirebase();
initializeHttpServer();

try {
	await initializeTuya();
} catch (e) {

}

startWatchdog();
