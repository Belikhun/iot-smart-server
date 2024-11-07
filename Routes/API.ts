import Elysia from "elysia";
import { userController } from "../Controllers/UserController";
import { authController } from "../Controllers/AuthController";

export const apiRouter = new Elysia({ prefix: "/api" })
	.use(authController)
	.use(userController);
