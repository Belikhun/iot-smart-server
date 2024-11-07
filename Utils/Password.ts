import hasher from "password-hash-and-salt";

export async function hashPassword(password: string): Promise<string> {
	return new Promise((resolve, reject) => {
		hasher(password).hash((error, hash) => {
			if (error)
				reject(error);

			resolve(hash);
		});
	});
}

export async function validatePassword(hash: string, password: string) : Promise<boolean> {
	return new Promise((resolve, reject) => {
		hasher(password).verifyAgainst(hash, (error, verified) => {
			if (error)
				reject(error);

			resolve(verified);
		});
	});
}
