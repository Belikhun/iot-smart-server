import { DataTypes, Model } from "sequelize";
import { database } from "../Config/Database";
import moment from "moment";

interface SceneActionAttributes {
	id?: number;
	sceneId: number;
	deviceFeatureId: number;
	action?: string;
	newValue?: string;
	created?: number;
	updated?: number;
}

class SceneActionModel extends Model<SceneActionAttributes> implements SceneActionAttributes {
	declare id?: number;
	declare sceneId: number;
	declare deviceFeatureId: number;
	declare action: string;
	declare newValue?: string;
	declare created?: number;
	declare updated?: number;

	public async getReturnData() {
		const data: any = { ...this.dataValues };
		return data;
	}
}

SceneActionModel.init({
	id: {
		type: DataTypes.INTEGER,
		autoIncrement: true,
		primaryKey: true
	},
	sceneId: {
		type: DataTypes.INTEGER,
		allowNull: false
	},
	deviceFeatureId: {
		type: DataTypes.INTEGER,
		allowNull: true
	},
	action: {
		type: DataTypes.TEXT,
		allowNull: false
	},
	newValue: {
		type: DataTypes.TEXT,
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
	tableName: "scene_actions",
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

export default SceneActionModel;
