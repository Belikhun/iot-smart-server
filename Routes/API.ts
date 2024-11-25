import Elysia from "elysia";
import { userController } from "../Controllers/UserController";
import { authController } from "../Controllers/AuthController";
import { deviceController } from "../Controllers/DeviceController";
import { triggerController } from "../Controllers/TriggerController";
import { dashboardController } from "../Controllers/DashboardController";
import { sceneController } from "../Controllers/SceneController";

export const apiRouter = new Elysia({ prefix: "/api" })
	.use(authController)
	.use(userController)
	.use(deviceController)
	.use(triggerController)
	.use(dashboardController)
	.use(sceneController);
