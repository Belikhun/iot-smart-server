import { DataTypes, Model } from "sequelize";
import { database } from "../Config/Database";

interface UserAttributes {
	id?: number;
	username: string;
	email: string;
	password: string;
	lastPassword?: string;
	lastIP?: string;
	isAdmin: boolean;
	readonly created?: Date;
	readonly updated?: Date;
}

class User extends Model<UserAttributes> implements UserAttributes {
	declare id: number;
	declare username: string;
	declare email: string;
	declare password: string;
	declare lastPassword: string;
	declare lastIP: string;
	declare isAdmin: boolean;
	declare readonly created: Date;
	declare readonly updated: Date;
}

User.init({
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
	created: {
		type: DataTypes.DATE,
		allowNull: false
	},
	updated: {
		type: DataTypes.DATE,
		allowNull: false
	}
}, {
	sequelize: database,
	tableName: "users",
	createdAt: "created",
	updatedAt: "updated"
});

export default User;
