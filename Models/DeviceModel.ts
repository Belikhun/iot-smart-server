import { DataTypes, Model } from "sequelize";
import { database } from "../Config/Database";
import moment from "moment";

interface DeviceAttributes {
	id?: number;
	externalId: string | null;
	hardwareId: string;
	name: string;
	type: "bareMetal" | string;
	icon?: string;
	color?: string;
	tags?: string;
	area?: string;
	token: string;
	created?: number;
	updated?: number;
}

class DeviceModel extends Model<DeviceAttributes> implements DeviceAttributes {
	declare id?: number;
	declare externalId: string | null;
	declare hardwareId: string;
	declare name: string;
	declare type: "bareMetal" | string;
	declare icon?: string;
	declare color?: string;
	declare tags?: string;
	declare area?: string;
	declare token: string;
	declare created?: number;
	declare updated?: number;
}

DeviceModel.init({
	id: {
		type: DataTypes.INTEGER,
		autoIncrement: true,
		primaryKey: true
	},
	externalId: {
		type: DataTypes.STRING,
		allowNull: true,
		unique: true
	},
	hardwareId: {
		type: DataTypes.STRING,
		allowNull: false,
		unique: true
	},
	name: {
		type: DataTypes.STRING,
		allowNull: false
	},
	type: {
		type: DataTypes.STRING,
		allowNull: false,
		defaultValue: "bareMetal"
	},
	icon: {
		type: DataTypes.STRING,
		allowNull: false,
		defaultValue: "houseSignal"
	},
	color: {
		type: DataTypes.STRING,
		allowNull: false,
		defaultValue: "accent"
	},
	tags: {
		type: DataTypes.TEXT,
		allowNull: false,
		defaultValue: ""
	},
	area: {
		type: DataTypes.STRING,
		allowNull: true
	},
	token: {
		type: DataTypes.TEXT,
		allowNull: false
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
	tableName: "devices",
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

export default DeviceModel;
