import { DataTypes, Model } from "sequelize";
import { database } from "../Config/Database";
import moment from "moment";

interface ScheduleAttributes {
	id?: number;
	name: string;
	icon: string;
	color: string;
	cronExpression?: string;
	executeAmount?: number;
	ran?: number;
	active?: boolean;
	created?: number;
	updated?: number;
}

class ScheduleModel extends Model<ScheduleAttributes> implements ScheduleAttributes {
	declare id?: number;
	declare name: string;
	declare icon: string;
	declare color: string;
	declare cronExpression?: string;
	declare executeAmount?: number;
	declare ran?: number;
	declare active?: boolean;
	declare created?: number;
	declare updated?: number;

	public async getReturnData() {
		const data: any = { ...this.dataValues };
		return data;
	}
}

ScheduleModel.init({
	id: {
		type: DataTypes.INTEGER,
		autoIncrement: true,
		primaryKey: true
	},
	name: {
		type: DataTypes.STRING(64),
		allowNull: false
	},
	icon: {
		type: DataTypes.STRING(22),
		allowNull: false
	},
	color: {
		type: DataTypes.STRING(22),
		allowNull: false
	},
	cronExpression: {
		type: DataTypes.STRING,
		allowNull: false,
		defaultValue: "* * * * * *"
	},
	executeAmount: {
		type: DataTypes.NUMBER,
		allowNull: false,
		defaultValue: 0
	},
	ran: {
		type: DataTypes.NUMBER,
		allowNull: false,
		defaultValue: 0
	},
	active: {
		type: DataTypes.BOOLEAN,
		allowNull: false,
		defaultValue: true
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
	tableName: "schedules",
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

export default ScheduleModel;
