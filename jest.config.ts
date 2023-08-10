import { pathsToModuleNameMapper } from "ts-jest";
import {compilerOptions} from "./tsconfig.json";

export default {
  preset: "ts-jest",
  testEnvironment: "node",
  moduleDirectories: ["node_modules", "./polars"],
  moduleFileExtensions: ["js", "ts"],
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths, { prefix: "<rootDir>/solana-bankrun" }),
  testPathIgnorePatterns: ["<rootDir>/tests/util.ts"],
  transform: {
    '^.+\\.{ts|tsx}?$': ['ts-jest', {
      tsConfig: 'tsconfig.json',
    }],
  },
};
