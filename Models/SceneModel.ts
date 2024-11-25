import { DataTypes, Model } from "sequelize";
import { database } from "../Config/Database";
import moment from "moment";

interface SceneAttributes {
	id?: number;
	name: string;
	icon: string;
	color: string;
	lastTrigger?: number;
	created?: number;
	updated?: number;
}

class SceneModel extends Model<SceneAttributes> implements SceneAttributes {
	declare id?: number;
	declare name: string;
	declare icon: string;
	declare color: string;
	declare lastTrigger?: number;
	declare created?: number;
	declare updated?: number;

	public async getReturnData() {
		const data: any = { ...this.dataValues };
		return data;
	}
}

SceneModel.init({
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
	lastTrigger: {
		type: DataTypes.INTEGER,
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
	tableName: "scenes",
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

export default SceneModel;
