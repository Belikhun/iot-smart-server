import { Sequelize } from "sequelize";
import { scope } from "../Utils/Logger";

const log = scope("db");

// Access environment variables directly through process.env
const {
	DB_HOST,
	DB_NAME,
	DB_USERNAME,
	DB_PASSWORD,
	DB_DIALECT
} = process.env;

if (!DB_HOST || !DB_NAME || !DB_USERNAME || !DB_PASSWORD || !DB_DIALECT)
	throw new Error("Thiếu các biến môi trường. Hãy kiểm tra file .env của bạn.");

// Create the Sequelize instance with the database configuration
export const database = new Sequelize(DB_NAME!, DB_USERNAME!, DB_PASSWORD!, {
	host: DB_HOST,
	dialect: DB_DIALECT as any, // Specify the type (mysql, postgres, etc.)
	logging: false
});

export const initializeDB = async () => {
	log.info(`Đang kết nối tới cơ sở dữ liệu ${DB_NAME} tại ${DB_HOST}...`);

	try {
		await database.authenticate({
			retry: {
				max: 3,
				report(message, obj, error) {
					if (error) {
						log.warn(`Kết nối tới cơ sở dữ liệu thất bại (${obj.$current}/${obj.max}): `, error);
						return;
					}

					log.info(`Đang kết nối... (#${obj.$current}/${obj.max})`);
				},
			}
		});

		log.success("Đã kết nối tới cơ sở dữ liệu");
	} catch (error) {
		log.error("Không thể kết nối tới cơ sở dữ liệu:", error);
	}
};
