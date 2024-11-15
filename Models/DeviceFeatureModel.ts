import { DataTypes, Model } from "sequelize";
import { database } from "../Config/Database";
import moment from "moment";

interface DeviceFeatureAttributes {
	id?: number;
	deviceId: number;
	featureId: string;
	uuid: string;
	name: string;
	kind: string;
	value?: any;
	previousValue?: any;
	flags?: number;
	extras?: object;
	created?: number;
	updated?: number;
}

class DeviceFeatureModel extends Model<DeviceFeatureAttributes> implements DeviceFeatureAttributes {
	declare id?: number;
	declare deviceId: number;
	declare featureId: string;
	declare uuid: string;
	declare name: string;
	declare kind: string;
	declare value?: any;
	declare previousValue?: any;
	declare flags?: number;
	declare extras?: object;
	declare created?: number;
	declare updated?: number;
}

DeviceFeatureModel.init({
	id: {
		type: DataTypes.INTEGER,
		autoIncrement: true,
		primaryKey: true
	},
	deviceId: {
		type: DataTypes.NUMBER,
		allowNull: false
	},
	featureId: {
		type: DataTypes.STRING,
		allowNull: false
	},
	uuid: {
		type: DataTypes.STRING,
		allowNull: false
	},
	name: {
		type: DataTypes.STRING,
		allowNull: false
	},
	kind: {
		type: DataTypes.STRING,
		allowNull: false
	},
	value: {
		type: DataTypes.STRING,
		allowNull: true
	},
	previousValue: {
		type: DataTypes.STRING,
		allowNull: true
	},
	flags: {
		type: DataTypes.INTEGER,
		allowNull: false,
		defaultValue: 3
	},
	extras: {
		type: DataTypes.TEXT,
		allowNull: true,
		get() {
			// @ts-expect-error
			return JSON.parse(this.getDataValue("extras"));
		},

		set(value) {
			// @ts-expect-error
			this.setDataValue("extras", JSON.stringify(value));
		},
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
	tableName: "device_features",
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

export default DeviceFeatureModel;
