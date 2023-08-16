import { pathsToModuleNameMapper } from "ts-jest";
import { compilerOptions } from "./tsconfig.json";

export default {
	preset: "ts-jest",
	testEnvironment: "node",
	moduleDirectories: ["node_modules", "./solana-bankrun"],
	moduleFileExtensions: ["js", "ts"],
	moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths, {
		prefix: "<rootDir>/solana-bankrun",
	}),
	// don't run copyAccounts tesst by default since devnet is flaky
	testPathIgnorePatterns: [
		"<rootDir>/tests/util.ts",
		"<rootDir>/tests/copyAccounts.test.ts",
	],
	transform: {
		"^.+\\.{ts|tsx}?$": [
			"ts-jest",
			{
				tsConfig: "tsconfig.json",
			},
		],
	},
};
