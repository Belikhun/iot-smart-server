import Elysia from "elysia";
import { userController } from "../Controllers/UserController";
import { authController } from "../Controllers/AuthController";

export const router = new Elysia({ prefix: "/api" })
	.use(authController)
	.use(userController);
