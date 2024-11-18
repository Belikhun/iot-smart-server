import Elysia from "elysia";
import DashboardItemModel from "../Models/DashboardItemModel";
import APIResponse from "../Classes/APIResponse";

export const dashboardController = new Elysia({ prefix: "/dashboard" });

dashboardController.post("/create", async ({ request }) => {
    const { name, icon, color, xPos, yPos, width, height, type, data } = await request.json();

    const instance = DashboardItemModel.build({
        name,
		icon,
		color,
        xPos,
        yPos,
        width,
        height,
        type,
        data
    });

    await instance.save();
    return new APIResponse(0, "Tạo khối thành công!", 200, await instance.getReturnData());
});

dashboardController.post("/:id/edit", async ({ params: { id }, request }) => {
    const instance = await DashboardItemModel.findByPk(id);

    if (!instance)
        return new APIResponse(1, "Khối không tồn tại!", 404);

    const { name, icon, color, xPos, yPos, width, height, type, data } = await request.json();

    if (name !== undefined) instance.name = name;
    if (icon !== undefined) instance.icon = icon;
    if (color !== undefined) instance.color = color;
    if (xPos !== undefined) instance.xPos = xPos;
    if (yPos !== undefined) instance.yPos = yPos;
    if (width !== undefined) instance.width = width;
    if (height !== undefined) instance.height = height;
    if (type !== undefined) instance.type = type;
    if (data !== undefined) instance.data = data;

    await instance.save();
    return new APIResponse(0, "Cập nhật khối thành công!", 200, await instance.getReturnData());
});

dashboardController.delete("/:id/delete", async ({ params: { id } }) => {
    const instance = await DashboardItemModel.findByPk(id);

    if (!instance)
        return new APIResponse(1, "Khối không tồn tại!", 404);

    await instance.destroy();
    return new APIResponse(0, "Xóa khối thành công!", 200);
});

dashboardController.get("/list", async () => {
    const instances = await DashboardItemModel.findAll({
        order: [["id", "DESC"]]
    });

	const data = [];

	for (const instance of instances)
		data.push(await instance.getReturnData());

    return new APIResponse(0, "Danh sách khối", 200, data);
});

dashboardController.get("/:id", async ({ params: { id } }) => {
    const instance = await DashboardItemModel.findByPk(id);

    if (!instance)
        return new APIResponse(1, "Khối không tồn tại!", 404);

    return new APIResponse(0, "Thông tin khối", 200, await instance.getReturnData());
});
