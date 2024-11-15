import { DataTypes, Model } from "sequelize";
import { database } from "../Config/Database";
import moment from "moment";

interface TriggerConditionItemAttributes {
	id?: number;
	triggerId: number;
	groupId: number;
	deviceFeatureId: number;
	comparator: string;
	value?: any;
	order: number;
	created?: number;
	updated?: number;
}

class TriggerConditionItemModel extends Model<TriggerConditionItemAttributes> implements TriggerConditionItemAttributes {
	declare id?: number;
	declare triggerId: number;
	declare groupId: number;
	declare deviceFeatureId: number;
	declare comparator: string;
	declare value?: any;
	declare order: number;
	declare created?: number;
	declare updated?: number;
}

TriggerConditionItemModel.init({
	id: {
		type: DataTypes.INTEGER,
		autoIncrement: true,
		primaryKey: true
	},
	triggerId: {
		type: DataTypes.NUMBER,
		allowNull: false
	},
	groupId: {
		type: DataTypes.NUMBER,
		allowNull: false
	},
	deviceFeatureId: {
		type: DataTypes.NUMBER,
		allowNull: false
	},
	comparator: {
		type: DataTypes.STRING,
		allowNull: false
	},
	value: {
		type: DataTypes.STRING,
		allowNull: true
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
	tableName: "trigger_condition_items",
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

export default TriggerConditionItemModel;
