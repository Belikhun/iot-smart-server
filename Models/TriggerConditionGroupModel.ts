import { DataTypes, Model } from "sequelize";
import { database } from "../Config/Database";
import moment from "moment";

interface TriggerConditionGroupAttributes {
	id?: number;
	triggerId: number;
	parentId: number | null;
	operator: string;
	order: number;
	created?: number;
	updated?: number;
}

class TriggerConditionGroupModel extends Model<TriggerConditionGroupAttributes> implements TriggerConditionGroupAttributes {
	declare id?: number;
	declare triggerId: number;
	declare parentId: number | null;
	declare operator: string;
	declare order: number;
	declare created?: number;
	declare updated?: number;
}

TriggerConditionGroupModel.init({
	id: {
		type: DataTypes.INTEGER,
		autoIncrement: true,
		primaryKey: true
	},
	triggerId: {
		type: DataTypes.NUMBER,
		allowNull: false
	},
	parentId: {
		type: DataTypes.NUMBER,
		allowNull: true
	},
	operator: {
		type: DataTypes.STRING,
		allowNull: false
	},
	order: {
		type: DataTypes.NUMBER,
		allowNull: false,
		defaultValue: 0
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
	tableName: "trigger_condition_groups",
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

export default TriggerConditionGroupModel;
