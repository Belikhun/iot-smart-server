import { initializeDB } from "./Config/Database";
import { initializeDevices } from "./Device/Device";
import { initializeHttpServer } from "./server";

initializeDB();
initializeHttpServer();
await initializeDevices();
