import { DataTypes, Model } from "sequelize";
import { database } from "../Config/Database";

interface UserAttributes {
	id?: number;
	username: string;
	email: string;
	password: string;
	lastPassword: string;
	lastIP: string;
	isAdmin: boolean;
	created: number;
	updated: number;
}

class User extends Model<UserAttributes> implements UserAttributes {
	public id!: number;
	public username!: string;
	public email!: string;
	public password!: string;
	public lastPassword!: string;
	public lastIP!: string;
	public isAdmin: boolean = false;
	public created!: number;
	public updated!: number;
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
		type: DataTypes.NUMBER,
		allowNull: false
	},
	updated: {
		type: DataTypes.NUMBER,
		allowNull: false
	}
}, {
	sequelize: database,
	tableName: "Users",
	createdAt: "created",
	updatedAt: "updated"
});

export default User;
