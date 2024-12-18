import { DataTypes, Model } from "sequelize";
import { database } from "../Config/Database";
import moment from "moment";

export type TriggerActionKind = "deviceFeature" | "scene";

interface TriggerActionAttributes {
	id?: number;
	triggerId: number;
	targetId: number;
	targetKind: TriggerActionKind;
	action?: string;
	newValue?: any;
	created?: number;
	updated?: number;
}

class TriggerActionModel extends Model<TriggerActionAttributes> implements TriggerActionAttributes {
	declare id?: number;
	declare triggerId: number;
	declare targetId: number;
	declare targetKind: TriggerActionKind;
	declare action?: string;
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
