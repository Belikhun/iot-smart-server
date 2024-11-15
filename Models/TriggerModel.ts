import { DataTypes, Model } from "sequelize";
import { database } from "../Config/Database";
import moment from "moment";

interface TriggerAttributes {
	id?: number;
	name: string;
	icon?: string;
	color?: string;
	lastTrigger?: number;
	created?: number;
	updated?: number;
}

class TriggerModel extends Model<TriggerAttributes> implements TriggerAttributes {
	declare id?: number;
	declare name: string;
	declare icon?: string;
	declare color?: string;
	declare lastTrigger?: number;
	declare created?: number;
	declare updated?: number;
}

TriggerModel.init({
	id: {
		type: DataTypes.INTEGER,
		autoIncrement: true,
		primaryKey: true
	},
	name: {
		type: DataTypes.STRING,
		allowNull: false
	},
	icon: {
		type: DataTypes.STRING,
		allowNull: false,
		defaultValue: "lassoSparkles"
	},
	color: {
		type: DataTypes.STRING,
		allowNull: false,
		defaultValue: "accent"
	},
	lastTrigger: {
		type: DataTypes.NUMBER,
		allowNull: false,
		defaultValue: ""
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
	tableName: "triggers",
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

export default TriggerModel;
