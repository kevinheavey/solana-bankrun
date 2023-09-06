import { start, ProgramTestContext } from "solana-bankrun";
import {
	PublicKey,
	LAMPORTS_PER_SOL,
	Transaction,
	TransactionInstruction,
	VersionedTransaction,
	VersionedMessage,
	MessageV0,
} from "@solana/web3.js";
import { helloworldProgram, helloworldProgramViaSetAccount } from "./util";

async function getLamports(
	ctx: ProgramTestContext,
	address: PublicKey,
): Promise<number | null> {
	const acc = await ctx.banksClient.getAccount(address);
	return acc === null ? null : acc.lamports;
}

test("hello world", async () => {
	const [ctx, programId, greetedPubkey] = await helloworldProgram();
	const lamports = await getLamports(ctx, greetedPubkey);
	expect(lamports === LAMPORTS_PER_SOL);
	const client = ctx.banksClient;
	const payer = ctx.payer;
	const blockhash = ctx.lastBlockhash;
	const greetedAccountBefore = await client.getAccount(greetedPubkey);
	expect(greetedAccountBefore).not.toBeNull();
	expect(greetedAccountBefore?.data).toEqual(new Uint8Array([0, 0, 0, 0]));
	const ix = new TransactionInstruction({
		keys: [{ pubkey: greetedPubkey, isSigner: false, isWritable: true }],
		programId,
		data: Buffer.from([0]),
	});
	const tx = new Transaction();
	tx.recentBlockhash = blockhash;
	tx.add(ix);
	tx.sign(payer);
	await client.processTransaction(tx);
	const greetedAccountAfter = await client.getAccount(greetedPubkey);
	expect(greetedAccountAfter).not.toBeNull();
	expect(greetedAccountAfter?.data).toEqual(new Uint8Array([1, 0, 0, 0]));
});

test("versioned tx", async () => {
	const [ctx, programId, greetedPubkey] = await helloworldProgram();
	const client = ctx.banksClient;
	const payer = ctx.payer;
	const blockhash = ctx.lastBlockhash;
	const ix = new TransactionInstruction({
		keys: [{ pubkey: greetedPubkey, isSigner: false, isWritable: true }],
		programId,
		data: Buffer.from([0]),
	});
	const msg = MessageV0.compile({
		payerKey: payer.publicKey,
		instructions: [ix],
		recentBlockhash: blockhash,
	});
	const tx = new VersionedTransaction(msg);
	tx.sign([payer]);
	await client.processTransaction(tx);
	const greetedAccountAfter = await client.getAccount(greetedPubkey);
	expect(greetedAccountAfter).not.toBeNull();
	expect(greetedAccountAfter?.data).toEqual(new Uint8Array([1, 0, 0, 0]));
});

test("compute limit", async () => {
	const [ctx, programId, greetedPubkey] = await helloworldProgram(10n);
	const ix = new TransactionInstruction({
		keys: [{ pubkey: greetedPubkey, isSigner: false, isWritable: true }],
		programId,
		data: Buffer.from([0]),
	});
	const client = ctx.banksClient;
	const payer = ctx.payer;
	const blockhash = ctx.lastBlockhash;
	const greetedAccountBefore = await client.getAccount(greetedPubkey);
	expect(greetedAccountBefore).not.toBeNull();
	expect(greetedAccountBefore?.data).toEqual(new Uint8Array([0, 0, 0, 0]));
	const tx = new Transaction();
	tx.recentBlockhash = blockhash;
	tx.add(ix);
	tx.sign(payer);
	await expect(client.processTransaction(tx)).rejects.toThrow(
		"Program failed to complete",
	);
});

test("tryProcessLegacyTransaction", async () => {
	const [ctx, programId, greetedPubkey] = await helloworldProgram(10n);
	const ix = new TransactionInstruction({
		keys: [{ pubkey: greetedPubkey, isSigner: false, isWritable: true }],
		programId,
		data: Buffer.from([0]),
	});
	const client = ctx.banksClient;
	const payer = ctx.payer;
	const blockhash = ctx.lastBlockhash;
	const tx = new Transaction();
	tx.recentBlockhash = blockhash;
	tx.add(ix);
	tx.sign(payer);
	const res = await client.tryProcessTransaction(tx);
	expect(res.result).toMatch("Program failed to complete");
});

test("tryProcessVersionedTransaction", async () => {
	const [ctx, programId, greetedPubkey] = await helloworldProgram(10n);
	const ix = new TransactionInstruction({
		keys: [{ pubkey: greetedPubkey, isSigner: false, isWritable: true }],
		programId,
		data: Buffer.from([0]),
	});
	const client = ctx.banksClient;
	const payer = ctx.payer;
	const blockhash = ctx.lastBlockhash;
	const msg = MessageV0.compile({
		payerKey: payer.publicKey,
		instructions: [ix],
		recentBlockhash: blockhash,
	});
	const tx = new VersionedTransaction(msg);
	tx.sign([payer]);
	const res = await client.tryProcessTransaction(tx);
	expect(res.result).toMatch("Program failed to complete");
});

test("non-existent account", async () => {
	const context = await start([], []);
	const client = context.banksClient;
	const acc = await client.getAccount(PublicKey.unique(), "processed");
	expect(acc).toBeNull();
});

test("non-existent program", async () => {
	const context = await start([], []);
	const ix = new TransactionInstruction({
		data: Buffer.alloc(1),
		keys: [],
		programId: PublicKey.unique(),
	});
	const tx = new Transaction().add(ix);
	tx.recentBlockhash = context.lastBlockhash;
	tx.sign(context.payer);
	const client = context.banksClient;
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
	const ix = new TransactionInstruction({
		keys: [{ pubkey: greetedPubkey, isSigner: false, isWritable: true }],
		programId,
		data: Buffer.from([0]),
	});
	const client = ctx.banksClient;
	const payer = ctx.payer;
	const blockhash = ctx.lastBlockhash;
	const greetedAccountBefore = await client.getAccount(greetedPubkey);
	expect(greetedAccountBefore).not.toBeNull();
	expect(greetedAccountBefore?.data).toEqual(new Uint8Array([0, 0, 0, 0]));
	const numIxs = 64;
	const ixs = Array(numIxs).fill(ix);
	const tx = new Transaction();
	tx.recentBlockhash = blockhash;
	tx.add(...ixs);
	tx.sign(payer);
	await client.processTransaction(tx);
	const greetedAccountAfter = await client.getAccount(greetedPubkey);
	expect(greetedAccountAfter).not.toBeNull();
	expect(greetedAccountAfter?.data).toEqual(new Uint8Array([64, 0, 0, 0]));
});

test("add program via setAccount", async () => {
	const [ctx, programId, greetedPubkey] =
		await helloworldProgramViaSetAccount();
	const client = ctx.banksClient;
	const payer = ctx.payer;
	const blockhash = ctx.lastBlockhash;
	const greetedAccountBefore = await client.getAccount(greetedPubkey);
	expect(greetedAccountBefore).not.toBeNull();
	expect(greetedAccountBefore?.data).toEqual(new Uint8Array([0, 0, 0, 0]));
	const ix = new TransactionInstruction({
		keys: [{ pubkey: greetedPubkey, isSigner: false, isWritable: true }],
		programId,
		data: Buffer.from([0]),
	});
	const tx = new Transaction();
	tx.recentBlockhash = blockhash;
	tx.add(ix);
	tx.sign(payer);
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
