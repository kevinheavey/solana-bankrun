import { start, ProgramTestContext } from "solana-bankrun";
import {
	AccountRole,
	Address,
	appendTransactionMessageInstruction,
	appendTransactionMessageInstructions,
	createTransactionMessage,
	generateKeyPairSigner,
	IInstruction,
	LamportsUnsafeBeyond2Pow53Minus1,
	pipe,
	setTransactionMessageFeePayerSigner,
	setTransactionMessageLifetimeUsingBlockhash,
	signTransactionMessageWithSigners,
} from "@solana/web3.js";
import { helloworldProgram, helloworldProgramViaSetAccount, LAMPORTS_PER_SOL } from "./util";

async function getLamports(
	ctx: ProgramTestContext,
	address: Address,
): Promise<LamportsUnsafeBeyond2Pow53Minus1 | null> {
	const acc = await ctx.banksClient.getAccount(address);
	return acc === null ? null : acc.lamports;
}

test("hello world", async () => {
	const [ctx, programId, greetedPubkey] = await helloworldProgram();
	const lamports = await getLamports(ctx, greetedPubkey);
	expect(lamports === LAMPORTS_PER_SOL);
	const client = ctx.banksClient;
	const payer = await ctx.payer;
	const [blockhash, lastValidBlockHeight] = await client.getLatestBlockhash();
	const greetedAccountBefore = await client.getAccount(greetedPubkey);
	expect(greetedAccountBefore).not.toBeNull();
	expect(greetedAccountBefore?.data).toEqual(new Uint8Array([0, 0, 0, 0]));
	const ix: IInstruction = {
		accounts: [{ address: greetedPubkey, role: AccountRole.WRITABLE }],
		programAddress: programId,
		data: Buffer.from([0]),
	};
	const tx = await pipe(
		createTransactionMessage({ version: "legacy" }),
		x => appendTransactionMessageInstruction(ix, x),
		x => setTransactionMessageFeePayerSigner(payer, x),
		x => setTransactionMessageLifetimeUsingBlockhash({ blockhash, lastValidBlockHeight }, x),
		x => signTransactionMessageWithSigners(x),
	);
	await client.processTransaction(tx);
	const greetedAccountAfter = await client.getAccount(greetedPubkey);
	expect(greetedAccountAfter).not.toBeNull();
	expect(greetedAccountAfter?.data).toEqual(new Uint8Array([1, 0, 0, 0]));
});

test("versioned tx", async () => {
	const [ctx, programId, greetedPubkey] = await helloworldProgram();
	const client = ctx.banksClient;
	const payer = await ctx.payer;
	const [blockhash, lastValidBlockHeight] = await client.getLatestBlockhash();

	const ix: IInstruction = {
		accounts: [{ address: greetedPubkey, role: AccountRole.WRITABLE }],
		programAddress: programId,
		data: Buffer.from([0]),
	};
	const tx = await pipe(
		createTransactionMessage({ version: 0 }),
		x => appendTransactionMessageInstruction(ix, x),
		x => setTransactionMessageFeePayerSigner(payer, x),
		x => setTransactionMessageLifetimeUsingBlockhash({ blockhash, lastValidBlockHeight }, x),
		x => signTransactionMessageWithSigners(x),
	);
	await client.processTransaction(tx);
	const greetedAccountAfter = await client.getAccount(greetedPubkey);
	expect(greetedAccountAfter).not.toBeNull();
	expect(greetedAccountAfter?.data).toEqual(new Uint8Array([1, 0, 0, 0]));
});

test("compute limit", async () => {
	const [ctx, programId, greetedPubkey] = await helloworldProgram(10n);
	const client = ctx.banksClient;
	const payer = await ctx.payer;
	const [blockhash, lastValidBlockHeight] = await client.getLatestBlockhash();

	const greetedAccountBefore = await client.getAccount(greetedPubkey);
	expect(greetedAccountBefore).not.toBeNull();
	expect(greetedAccountBefore?.data).toEqual(new Uint8Array([0, 0, 0, 0]));

	const ix: IInstruction = {
		accounts: [{ address: greetedPubkey, role: AccountRole.WRITABLE }],
		programAddress: programId,
		data: Buffer.from([0]),
	};
	const tx = await pipe(
		createTransactionMessage({ version: 0 }),
		x => appendTransactionMessageInstruction(ix, x),
		x => setTransactionMessageFeePayerSigner(payer, x),
		x => setTransactionMessageLifetimeUsingBlockhash({ blockhash, lastValidBlockHeight }, x),
		x => signTransactionMessageWithSigners(x),
	);
	await expect(client.processTransaction(tx)).rejects.toThrow(
		"Program failed to complete",
	);
});

test("tryProcessLegacyTransaction", async () => {
	const [ctx, programId, greetedPubkey] = await helloworldProgram(10n);
	const client = ctx.banksClient;
	const payer = await ctx.payer;
	const [blockhash, lastValidBlockHeight] = await client.getLatestBlockhash();

	const ix: IInstruction = {
		accounts: [{ address: greetedPubkey, role: AccountRole.WRITABLE }],
		programAddress: programId,
		data: Buffer.from([0]),
	};
	const tx = await pipe(
		createTransactionMessage({ version: "legacy" }),
		x => appendTransactionMessageInstruction(ix, x),
		x => setTransactionMessageFeePayerSigner(payer, x),
		x => setTransactionMessageLifetimeUsingBlockhash({ blockhash, lastValidBlockHeight }, x),
		x => signTransactionMessageWithSigners(x),
	);

	const res = await client.tryProcessTransaction(tx);
	expect(res.result).toMatch("Program failed to complete");
});

test("tryProcessVersionedTransaction", async () => {
	const [ctx, programId, greetedPubkey] = await helloworldProgram(10n);
	const client = ctx.banksClient;
	const payer = await ctx.payer;
	const [blockhash, lastValidBlockHeight] = await client.getLatestBlockhash();

	const ix: IInstruction = {
		accounts: [{ address: greetedPubkey, role: AccountRole.WRITABLE }],
		programAddress: programId,
		data: Buffer.from([0]),
	};
	const tx = await pipe(
		createTransactionMessage({ version: 0 }),
		x => appendTransactionMessageInstruction(ix, x),
		x => setTransactionMessageFeePayerSigner(payer, x),
		x => setTransactionMessageLifetimeUsingBlockhash({ blockhash, lastValidBlockHeight }, x),
		x => signTransactionMessageWithSigners(x),
	);
	const res = await client.tryProcessTransaction(tx);
	expect(res.result).toMatch("Program failed to complete");
});

test("non-existent account", async () => {
	const context = await start([], []);
	const client = context.banksClient;
	const pubkey = await generateKeyPairSigner().then(x => x.address);
	const acc = await client.getAccount(pubkey, "processed");
	expect(acc).toBeNull();
});

test("non-existent program", async () => {
	const context = await start([], []);
	const client = context.banksClient;
	const payer = await context.payer;
	const [blockhash, lastValidBlockHeight] = await client.getLatestBlockhash();
	const programId = await generateKeyPairSigner().then(x => x.address);
	const ix: IInstruction = {
		accounts: [],
		programAddress: programId,
		data: Buffer.alloc(1),
	};
	const tx = await pipe(
		createTransactionMessage({ version: 0 }),
		x => appendTransactionMessageInstruction(ix, x),
		x => setTransactionMessageFeePayerSigner(payer, x),
		x => setTransactionMessageLifetimeUsingBlockhash({ blockhash, lastValidBlockHeight }, x),
		x => signTransactionMessageWithSigners(x),
	);
	await expect(client.processTransaction(tx)).rejects.toThrow(
		"Attempt to load a program that does not exist",
	);
});

test("warp", async () => {
	const context = await start([], []);
	const client = context.banksClient;
	const slot0 = await client.getSlot();
	expect(slot0).toBe(1n);
	const newSlot = 1000n;
	context.warpToSlot(newSlot);
	const slot1 = await client.getSlot();
	expect(slot1).toBe(newSlot);
});

test("many instructions", async () => {
	const [ctx, programId, greetedPubkey] = await helloworldProgram();
	const ix: IInstruction = {
		accounts: [{ address: greetedPubkey, role: AccountRole.WRITABLE }],
		programAddress: programId,
		data: Buffer.from([0]),
	};
	const client = ctx.banksClient;
	const payer = await ctx.payer;
	const [blockhash, lastValidBlockHeight] = await client.getLatestBlockhash();
	const greetedAccountBefore = await client.getAccount(greetedPubkey);
	expect(greetedAccountBefore).not.toBeNull();
	expect(greetedAccountBefore?.data).toEqual(new Uint8Array([0, 0, 0, 0]));
	const numIxs = 64;
	const ixs = Array(numIxs).fill(ix);
	const tx = await pipe(
		createTransactionMessage({ version: 0 }),
		x => appendTransactionMessageInstructions(ixs, x),
		x => setTransactionMessageFeePayerSigner(payer, x),
		x => setTransactionMessageLifetimeUsingBlockhash({ blockhash, lastValidBlockHeight }, x),
		x => signTransactionMessageWithSigners(x),
	);
	await client.processTransaction(tx);
	const greetedAccountAfter = await client.getAccount(greetedPubkey);
	expect(greetedAccountAfter).not.toBeNull();
	expect(greetedAccountAfter?.data).toEqual(new Uint8Array([64, 0, 0, 0]));
});

test("add program via setAccount", async () => {
	const [ctx, programId, greetedPubkey] =
		await helloworldProgramViaSetAccount();
	const client = ctx.banksClient;
	const payer = await ctx.payer;
	const [blockhash, lastValidBlockHeight] = await client.getLatestBlockhash();
	const greetedAccountBefore = await client.getAccount(greetedPubkey);
	expect(greetedAccountBefore).not.toBeNull();
	expect(greetedAccountBefore?.data).toEqual(new Uint8Array([0, 0, 0, 0]));
	const ix: IInstruction = {
		accounts: [{ address: greetedPubkey, role: AccountRole.WRITABLE }],
		programAddress: programId,
		data: Buffer.from([0]),
	};
	const tx = await pipe(
		createTransactionMessage({ version: 0 }),
		x => appendTransactionMessageInstruction(ix, x),
		x => setTransactionMessageFeePayerSigner(payer, x),
		x => setTransactionMessageLifetimeUsingBlockhash({ blockhash, lastValidBlockHeight }, x),
		x => signTransactionMessageWithSigners(x),
	);
	await client.processTransaction(tx);
	const greetedAccountAfter = await client.getAccount(greetedPubkey);
	expect(greetedAccountAfter).not.toBeNull();
	expect(greetedAccountAfter?.data).toEqual(new Uint8Array([1, 0, 0, 0]));
});

test("warp epoch", async () => {
	const context = await start([], []);
	const client = context.banksClient;
	const epochSchedule = context.genesisConfig.epochSchedule;
	context.warpToSlot(epochSchedule.firstNormalSlot);
	const slotBefore = await client.getSlot();
	const epochBefore = (await client.getClock()).epoch;
	context.warpToSlot(slotBefore + epochSchedule.slotsPerEpoch);
	const epochAfter = (await client.getClock()).epoch;
	expect(epochAfter).toBe(epochBefore + 1n);
});
