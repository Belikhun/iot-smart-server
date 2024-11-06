import { DataTypes, Model } from "sequelize";
import { sequelize } from "../Config/Database";

interface UserAttributes {
	id?: number;
	username: string;
	email: string;
	password: string;
}

class User extends Model<UserAttributes> implements UserAttributes {
	public id!: number;
	public username!: string;
	public email!: string;
	public password!: string;
}

User.init({
	id: {
		type: DataTypes.INTEGER,
		autoIncrement: true,
		primaryKey: true
	},
	username: {
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
	}
}, {
	sequelize,
	tableName: "users"
});

export default User;
