const {
	HOST,
	PORT,

	DB_HOST,
	DB_NAME,
	DB_USERNAME,
	DB_PASSWORD,
	DB_DIALECT
} = process.env;

const config = {
	"development": {
		"username": DB_USERNAME,
		"password": DB_PASSWORD,
		"database": DB_NAME,
		"host": DB_HOST,
		"dialect": DB_DIALECT
	},
	
	"test": {
		"username": DB_USERNAME,
		"password": DB_PASSWORD,
		"database": DB_NAME,
		"host": DB_HOST,
		"dialect": DB_DIALECT
	},

	"production": {
		"username": DB_USERNAME,
		"password": DB_PASSWORD,
		"database": DB_NAME,
		"host": DB_HOST,
		"dialect": DB_DIALECT
	},

	host: HOST || "0.0.0.0",
	port: PORT || "80"
};

export default config;
