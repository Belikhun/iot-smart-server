import { Sequelize } from "sequelize";

// Access environment variables directly through process.env
const {
	DB_HOST,
	DB_NAME,
	DB_USERNAME,
	DB_PASSWORD,
	DB_DIALECT
} = process.env;

if (!DB_HOST || !DB_NAME || !DB_USERNAME || !DB_PASSWORD || !DB_DIALECT)
	throw new Error("Missing environment variables. Please check your .env file.");

// Create the Sequelize instance with the database configuration
export const sequelize = new Sequelize(DB_NAME!, DB_USERNAME!, DB_PASSWORD!, {
	host: DB_HOST,
	dialect: DB_DIALECT as any, // Specify the type (mysql, postgres, etc.)
	logging: false,
});

console.log(`Connecting to database ${DB_NAME} at ${DB_HOST}...`);
