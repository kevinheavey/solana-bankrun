import { start, ProgramTestContext } from "../solana-bankrun";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { readFileSync } from "node:fs";

export async function helloworldProgram(
	computeMaxUnits?: bigint,
): Promise<[ProgramTestContext, PublicKey, PublicKey]> {
	const programId = PublicKey.unique();
	const greetedPubkey = PublicKey.unique();
	const programs = [{ name: "helloworld", programId }];
	const accounts = [
		{
			address: greetedPubkey,
			info: {
				executable: false,
				owner: programId,
				lamports: LAMPORTS_PER_SOL,
				data: new Uint8Array([0, 0, 0, 0]),
			},
		},
	];
	let ctx = await start(programs, accounts, computeMaxUnits);
	// let ctx = await start([], [], computeMaxUnits);
	return [ctx, programId, greetedPubkey];
}

export async function helloworldProgramViaSetAccount(
	computeMaxUnits?: bigint,
): Promise<[ProgramTestContext, PublicKey, PublicKey]> {
	const programId = PublicKey.unique();
	const greetedPubkey = PublicKey.unique();
	const programBytes = readFileSync("tests/fixtures/helloworld.so");
	const accounts = [
		{
			address: greetedPubkey,
			info: {
				executable: false,
				owner: programId,
				lamports: LAMPORTS_PER_SOL,
				data: new Uint8Array([0, 0, 0, 0]),
			},
		},
	];
	let ctx = await start([], accounts, computeMaxUnits);
	const executableAccount = {
		lamports: 1_000_000_000_000,
		executable: true,
		owner: new PublicKey("BPFLoader2111111111111111111111111111111111"),
		data: programBytes,
	};
	ctx.setAccount(programId, executableAccount);
	return [ctx, programId, greetedPubkey];
}
