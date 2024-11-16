import { DataTypes, Model } from "sequelize";
import { database } from "../Config/Database";
import moment from "moment";

interface UserAttributes {
	id?: number;
	username: string;
	name: string;
	email: string;
	password: string;
	lastPassword?: string;
	lastIP?: string;
	isAdmin: boolean;
	lastAccess?: number;
	created?: number;
	updated?: number;
}

class UserModel extends Model<UserAttributes> implements UserAttributes {
	declare id: number;
	declare username: string;
	declare name: string;
	declare email: string;
	declare password: string;
	declare lastPassword: string;
	declare lastIP: string;
	declare isAdmin: boolean;
	declare lastAccess: number;
	declare created: number;
	declare updated: number;

	public async getReturnData() {
		const data: any = { ...this.dataValues };

		delete data.password;
		delete data.lastPassword;

		return data;
	}
}

UserModel.init({
	id: {
		type: DataTypes.INTEGER,
		autoIncrement: true,
		primaryKey: true
	},
	username: {
		type: DataTypes.STRING,
		allowNull: false,
		unique: true
	},
	name: {
		type: DataTypes.STRING,
		allowNull: false
	},
	email: {
		type: DataTypes.STRING,
		allowNull: false,
		unique: true
	},
	password: {
		type: DataTypes.STRING,
		allowNull: false
	},
	lastPassword: {
		type: DataTypes.STRING,
		allowNull: true
	},
	lastIP: {
		type: DataTypes.STRING,
		allowNull: true
	},
	isAdmin: {
		type: DataTypes.BOOLEAN,
		allowNull: false,
		defaultValue: false
	},
	lastAccess: {
		type: DataTypes.NUMBER,
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
	tableName: "users",
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

export default UserModel;
