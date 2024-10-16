import { start, ProgramTestContext } from "../solana-bankrun";
import { address, Address, generateKeyPairSigner, lamports } from "@solana/web3.js";
import { readFileSync } from "node:fs";

export const LAMPORTS_PER_SOL = lamports(1_000_000_000n);

export async function helloworldProgram(
	computeMaxUnits?: bigint,
): Promise<[ProgramTestContext, Address, Address]> {
	const programId = (await generateKeyPairSigner()).address;
	const greetedPubkey = (await generateKeyPairSigner()).address;
	const programs = [{ name: "helloworld", programId }];
	const accounts = [
		{
			address: greetedPubkey,
			info: {
				executable: false,
				owner: programId,
				lamports: LAMPORTS_PER_SOL,
				data: new Uint8Array([0, 0, 0, 0]),
				rentEpoch: 0n,
			},
		},
	];
	const ctx = await start(programs, accounts, computeMaxUnits);
	// let ctx = await start([], [], computeMaxUnits);
	return [ctx, programId, greetedPubkey];
}

export async function helloworldProgramViaSetAccount(
	computeMaxUnits?: bigint,
): Promise<[ProgramTestContext, Address, Address]> {
	const programId = (await generateKeyPairSigner()).address;
	const greetedPubkey = (await generateKeyPairSigner()).address;
	const programBytes = readFileSync("tests/fixtures/helloworld.so");
	const accounts = [
		{
			address: greetedPubkey,
			info: {
				executable: false,
				owner: programId,
				lamports: LAMPORTS_PER_SOL,
				data: new Uint8Array([0, 0, 0, 0]),
				rentEpoch: 0n,
			},
		},
	];
	const ctx = await start([], accounts, computeMaxUnits);
	const executableAccount = {
		lamports: LAMPORTS_PER_SOL,
		executable: true,
		owner: address("BPFLoader2111111111111111111111111111111111"),
		data: programBytes,
		rentEpoch: 0n,
	};
	ctx.setAccount(programId, executableAccount);
	return [ctx, programId, greetedPubkey];
}
