import { DataTypes, Model } from "sequelize";
import { database } from "../Config/Database";
import UserModel from "./UserModel";
import { randomUUID } from "crypto";
import { time } from "../Utils/belibrary";
import moment from "moment";

interface SessionAttributes {
	id?: number;
	sessionId: string;
	userId: number;
	data?: object;
	ipAddress?: string;
	expire: number;
	created?: number;
	updated?: number;
}

class SessionModel extends Model<SessionAttributes> implements SessionAttributes {
	declare id: number;
	declare sessionId: string;
	declare userId: number;
	declare data: object;
	declare ipAddress: string;
	declare expire: number;
	declare created: number;
	declare updated: number;

	public isActive(): boolean {
		return (this.expire >= time());
	}

	public async getUser(): Promise<UserModel | null> {
		return await UserModel.findOne({ where: { id: this.userId } });
	}

	public async invalidate() {
		this.expire = time() - 1;
		await this.save();
		return this;
	}

	public async getReturnData() {
		const data: any = { ...this.dataValues };
		delete data.data;
		delete data.userId;
		data.user = await this.getUser();

		if (data.user)
			data.user = await data.user.getReturnData();

		return data;
	}

	public static async start(user: UserModel) {
		const uuid = randomUUID();

		const instance = this.build({
			sessionId: uuid,
			userId: user.id,
			expire: moment().add(1, "month").unix(),
			ipAddress: user.lastIP
		});

		await instance.save();
		return instance;
	}
}

SessionModel.init({
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
		type: DataTypes.INTEGER,
		allowNull: false
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
	tableName: "sessions",
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

export default SessionModel;
