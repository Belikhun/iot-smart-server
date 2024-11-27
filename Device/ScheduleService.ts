import { CronJob } from "cron";
import ScheduleActionModel from "../Models/ScheduleActionModel";
import ScheduleModel from "../Models/ScheduleModel";
import { scope, type Logger } from "../Utils/Logger";
import { ScheduleAction } from "./Schedules/ScheduleAction";

type ScheduleDict = { [id: number]: Schedule };

const log = scope("schedules");
const schedules: ScheduleDict = {};

export class Schedule {

	public model: ScheduleModel;
	protected log: Logger;
	protected job: CronJob | null = null;
	public lastResult: boolean = false;

	public actions: { [id: number]: ScheduleAction } = [];

	public constructor(model: ScheduleModel) {
		this.model = model;
		this.log = scope(`schedule:#${this.model.id}`);
	}

	public async load() {
		this.start();

		this.log.info(`Đang lấy thông tin các hành động...`);
		const actionModels = await ScheduleActionModel.findAll({
			where: { scheduleId: this.model.id }
		});

		for (const actionModel of actionModels)
			this.actions[actionModel.id as number] = new ScheduleAction(actionModel, this);
	}

	public start() {
		if (this.job)
			this.job.stop();

		if (!this.model.cronExpression || !this.model.active)
			return;

		this.log.debug(`Bắt đầu tác vụ chạy với expression ${this.model.cronExpression}`);

		this.job = CronJob.from({
			cronTime: this.model.cronExpression as string,
			start: true,
			onTick: () => {
				this.execute();
			}
		});
	}

	public execute() {
		if (this.job) {
			if (this.model.executeAmount! > 0 && this.model.ran! >= this.model.executeAmount!) {
				this.job.stop();
				this.job = null;

				this.log.debug(`Tác vụ chạy bị dừng do đã chạy tới số lần chạy tối đa`);
				return false;
			}
		}

		for (const action of Object.values(this.actions))
			action.execute();

		if (!this.model.ran)
			this.model.ran = 0;

		this.model.ran += 1;
		this.model.save();
		return true;
	}

	public async getReturnData() {
		return {
			...this.model.dataValues,
			lastResult: this.lastResult
		}
	}
}

export const initializeSchedules = async () => {
	log.info(`Đang lấy thông tin các lịch điều khiển đã đăng ký...`);
	const scheduleModels = await ScheduleModel.findAll({ order: [["id", "DESC"]] });
	log.success(`Tìm thấy ${scheduleModels.length} lịch điều khiển đã đăng ký`);

	for (const scheduleModel of scheduleModels) {
		log.info(`Đang nạp lịch điều khiển ${scheduleModel.name} [#${scheduleModel.id}]`);
		const schedule = new Schedule(scheduleModel);
		await schedule.load();
		schedules[schedule.model.id as number] = schedule;
		log.success(`Nạp lịch điều khiển ${schedule.model.name} thành công!`);
	}
}

export const getSchedules = () => {
	return schedules;
}

export const getSchedule = (id: number): Schedule | null => {
	if (schedules[id])
		return schedules[id];

	return null;
}

export const registerSchedule = async (scheduleModel: ScheduleModel): Promise<Schedule> => {
	const schedule = new Schedule(scheduleModel);
	await schedule.load();
	schedules[schedule.model.id as number] = schedule;
	return schedule;
}
