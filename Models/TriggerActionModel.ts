import { DataTypes, Model } from "sequelize";
import { database } from "../Config/Database";
import moment from "moment";

interface TriggerActionAttributes {
	id?: number;
	triggerId: number;
	deviceFeatureId: number;
	newValue?: any;
	created?: number;
	updated?: number;
}

class TriggerActionModel extends Model<TriggerActionAttributes> implements TriggerActionAttributes {
	declare id?: number;
	declare triggerId: number;
	declare deviceFeatureId: number;
	declare newValue?: any;
	declare created?: number;
	declare updated?: number;
}

TriggerActionModel.init({
	id: {
		type: DataTypes.INTEGER,
		autoIncrement: true,
		primaryKey: true
	},
	triggerId: {
		type: DataTypes.NUMBER,
		allowNull: false
	},
	deviceFeatureId: {
		type: DataTypes.NUMBER,
		allowNull: false
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
	tableName: "trigger_actions",
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

export default TriggerActionModel;
