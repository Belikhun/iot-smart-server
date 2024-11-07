import { initializeDB } from "./Config/Database";
import { initializeHttpServer } from "./server";

initializeDB();
initializeHttpServer();
