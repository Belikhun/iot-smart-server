import { DataTypes, Model } from "sequelize";
import { database } from "../Config/Database";
import moment from "moment";

export enum DeviceFeatureKind {
	LIGHT = "light"
}

interface DeviceFeatureAttributes {
	id?: number;
	deviceId: number;
	kind: DeviceFeatureKind;
	value: any;
	valueUnit: string;
	created?: number;
	updated?: number;
}

class DeviceFeatureModel extends Model<DeviceFeatureAttributes> implements DeviceFeatureAttributes {
	declare id?: number;
	declare deviceId: number;
	declare kind: DeviceFeatureKind;
	declare value: any;
	declare valueUnit: string;
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
		type: DataTypes.INTEGER,
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
	valueUnit: {
		type: DataTypes.STRING,
		allowNull: false
	},
	created: {
		type: DataTypes.INTEGER,
		allowNull: false
	},
	updated: {
		type: DataTypes.INTEGER,
		allowNull: false
	}
}, {
	sequelize: database,
	tableName: "deviceFeatures",
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
