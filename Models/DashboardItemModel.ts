import { DataTypes, Model } from "sequelize";
import { database } from "../Config/Database";
import moment from "moment";

interface DashboardItemAttributes {
	id?: number;
	name: string;
	color: string;
	icon: string;
	xPos: number;
	yPos: string;
	width: string;
	height: string;
	type: string;
	data?: object;
	created?: number;
	updated?: number;
}

class DashboardItemModel extends Model<DashboardItemAttributes> implements DashboardItemAttributes {
	declare id?: number;
	declare name: string;
	declare color: string;
	declare icon: string;
	declare xPos: number;
	declare yPos: string;
	declare width: string;
	declare height: string;
	declare type: string;
	declare data?: object;
	declare created?: number;
	declare updated?: number;

	public async getReturnData() {
		const data: any = { ...this.dataValues };
		data.data = this.data;
		return data;
	}
}

DashboardItemModel.init({
	id: {
		type: DataTypes.INTEGER,
		autoIncrement: true,
		primaryKey: true
	},
	name: {
		type: DataTypes.STRING,
		allowNull: false
	},
	color: {
		type: DataTypes.STRING,
		allowNull: false
	},
	icon: {
		type: DataTypes.STRING,
		allowNull: false
	},
	xPos: {
		type: DataTypes.INTEGER,
		allowNull: false
	},
	yPos: {
		type: DataTypes.INTEGER,
		allowNull: false
	},
	width: {
		type: DataTypes.INTEGER,
		allowNull: false
	},
	height: {
		type: DataTypes.INTEGER,
		allowNull: false
	},
	type: {
		type: DataTypes.STRING,
		allowNull: false
	},
	data: {
		type: DataTypes.TEXT,
		allowNull: true,
		get() {
			// @ts-expect-error
			return JSON.parse(this.getDataValue("data"));
		},

		set(value) {
			// @ts-expect-error
			this.setDataValue("data", JSON.stringify(value));
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
	tableName: "dashboard_items",
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

export default DashboardItemModel;
