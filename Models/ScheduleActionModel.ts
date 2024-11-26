import { DataTypes, Model } from "sequelize";
import { database } from "../Config/Database";
import moment from "moment";

export type ScheduleActionKind = "deviceFeature" | "scene";

interface ScheduleActionAttributes {
	id?: number;
	scheduleId: number;
	targetId: number;
	targetKind: ScheduleActionKind;
	action?: string;
	newValue?: any;
	created?: number;
	updated?: number;
}

class ScheduleActionModel extends Model<ScheduleActionAttributes> implements ScheduleActionAttributes {
	declare id?: number;
	declare scheduleId: number;
	declare targetId: number;
	declare targetKind: ScheduleActionKind;
	declare action?: string;
	declare newValue?: any;
	declare created?: number;
	declare updated?: number;
}

ScheduleActionModel.init({
	id: {
		type: DataTypes.INTEGER,
		autoIncrement: true,
		primaryKey: true
	},
	scheduleId: {
		type: DataTypes.NUMBER,
		allowNull: false
	},
	targetId: {
		type: DataTypes.NUMBER,
		allowNull: false
	},
	targetKind: {
		type: DataTypes.NUMBER,
		allowNull: false
	},
	action: {
		type: DataTypes.STRING,
		allowNull: true,
		defaultValue: "setValue"
	},
	newValue: {
		type: DataTypes.STRING,
		allowNull: true
	},
	created: {
		type: DataTypes.INTEGER,
		allowNull: false,
		defaultValue: () => moment().unix()
	},
	updated: {
		type: DataTypes.INTEGER,
		allowNull: false,
		defaultValue: () => moment().unix()
	}
}, {
	sequelize: database,
	tableName: "schedule_actions",
	createdAt: "created",
	updatedAt: "updated",
	timestamps: true,
	hooks: {
		beforeCreate(instance) {
			instance.created = instance.updated = moment().unix();
		},

		beforeUpdate(instance) {
			instance.updated = moment().unix();
		}
	}
});

export default ScheduleActionModel;
