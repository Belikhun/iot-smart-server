import { initializeDB } from "./Config/Database";
import { initializeDevices } from "./Device/Device";
import { initializeHttpServer } from "./server";
import { startWatchdog } from "./watchdog";

initializeDB();
initializeHttpServer();
await initializeDevices();
startWatchdog();
