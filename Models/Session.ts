import { DataTypes, Model } from "sequelize";
import { database } from "../Config/Database";
import type User from "./User";
import { randomUUID } from "crypto";
import { time } from "../Utils/belibrary";
import moment from "moment";

interface SessionAttributes {
	id?: number;
	sessionId: string;
	userId: number;
	data?: object;
	ipAddress?: string;
	expire: Date;
	readonly created?: Date;
	readonly updated?: Date;
}

class Session extends Model<SessionAttributes> implements SessionAttributes {
	declare id: number;
	declare sessionId: string;
	declare userId: number;
	declare data: object;
	declare ipAddress: string;
	declare expire: Date;
	declare readonly created: Date;
	declare readonly updated: Date;

	public static async start(user: User) {
		const uuid = randomUUID();

		const instance = this.build({
			sessionId: uuid,
			userId: user.id,
			expire: moment().add(1, "month").toDate(),
			ipAddress: user.lastIP
		});

		await instance.save();
		return instance;
	}
}

Session.init({
	id: {
		type: DataTypes.INTEGER,
		autoIncrement: true,
		primaryKey: true
	},
	sessionId: {
		type: DataTypes.UUIDV4,
		allowNull: false,
		unique: true
	},
	userId: {
		type: DataTypes.INTEGER,
		allowNull: false,
		unique: true
	},
	data: {
		type: DataTypes.JSON,
		allowNull: true
	},
	ipAddress: {
		type: DataTypes.STRING,
		allowNull: true
	},
	expire: {
		type: DataTypes.DATE,
		allowNull: false
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
	tableName: "sessions",
	createdAt: "created",
	updatedAt: "updated"
});

export default Session;
