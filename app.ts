import { initializeDB } from "./Config/Database";
import { initializeDevices } from "./Device/Device";
import { initializeTriggers } from "./Device/TriggerService";
import { initializeHttpServer } from "./server";
import { startWatchdog } from "./watchdog";

initializeDB();
initializeHttpServer();
await initializeDevices();
await initializeTriggers();
startWatchdog();
