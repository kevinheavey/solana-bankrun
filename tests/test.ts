import test from "ava";
import { start, ProgramTestContext } from "../solana-bankrun";
import {
	PublicKey,
	LAMPORTS_PER_SOL,
	Transaction,
	TransactionInstruction,
} from "@solana/web3.js";
import { helloworldProgram, helloworldProgramViaSetAccount } from "./util";

async function getLamports(
	ctx: ProgramTestContext,
	address: PublicKey,
): Promise<number | null> {
	let acc = await ctx.banksClient.getAccount(address);
	return acc === null ? null : acc.lamports;
}

test("hello world", async (t) => {
	let [ctx, programId, greetedPubkey] = await helloworldProgram();
	let lamports = await getLamports(ctx, greetedPubkey);
	t.assert(lamports === LAMPORTS_PER_SOL);
	let client = ctx.banksClient;
	const payer = ctx.payer;
	const blockhash = ctx.lastBlockhash;
	const greetedAccountBefore = await client.getAccount(greetedPubkey);
	t.assert(greetedAccountBefore != null);
	t.deepEqual(greetedAccountBefore?.data, new Uint8Array([0, 0, 0, 0]));
	const ix = new TransactionInstruction({
		keys: [{ pubkey: greetedPubkey, isSigner: false, isWritable: true }],
		programId,
		data: Buffer.from([0]),
	});
	let tx = new Transaction();
	tx.recentBlockhash = blockhash;
	tx.add(ix);
	tx.sign(payer);
	await client.processTransaction(tx);
	const greetedAccountAfter = await client.getAccount(greetedPubkey);
	t.assert(greetedAccountAfter != null);
	t.deepEqual(greetedAccountAfter?.data, new Uint8Array([1, 0, 0, 0]));
});

test("compute limit", async (t) => {
	let [ctx, programId, greetedPubkey] = await helloworldProgram(10n);
	const ix = new TransactionInstruction({
		keys: [{ pubkey: greetedPubkey, isSigner: false, isWritable: true }],
		programId,
		data: Buffer.from([0]),
	});
	let client = ctx.banksClient;
	const payer = ctx.payer;
	const blockhash = ctx.lastBlockhash;
	const greetedAccountBefore = await client.getAccount(greetedPubkey);
	t.assert(greetedAccountBefore != null);
	t.deepEqual(greetedAccountBefore?.data, new Uint8Array([0, 0, 0, 0]));
	let tx = new Transaction();
	tx.recentBlockhash = blockhash;
	tx.add(ix);
	tx.sign(payer);
	const error = await t.throwsAsync(
		async () => await client.processTransaction(tx),
	);
	t.assert(error?.message.includes("Program failed to complete"));
});

test("non-existent account", async (t) => {
	const context = await start([], []);
	const client = context.banksClient;
	const acc = await client.getAccount(PublicKey.unique(), "processed");
	t.is(acc, null);
});

test("non-existent program", async (t) => {
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
	const error = await t.throwsAsync(
		async () => await client.processTransaction(tx),
	);
	t.assert(
		error?.message.includes("Attempt to load a program that does not exist"),
	);
});

test("warp", async (t) => {
	const context = await start([], []);
	const client = context.banksClient;
	const slot0 = await client.getSlot();
	t.deepEqual(slot0, 1n);
	const newSlot = 1000n;
	context.warpToSlot(newSlot);
	const slot1 = await client.getSlot();
	t.deepEqual(slot1, newSlot);
});

test("many instructions", async (t) => {
	let [ctx, programId, greetedPubkey] = await helloworldProgram();
	const ix = new TransactionInstruction({
		keys: [{ pubkey: greetedPubkey, isSigner: false, isWritable: true }],
		programId,
		data: Buffer.from([0]),
	});
	let client = ctx.banksClient;
	const payer = ctx.payer;
	const blockhash = ctx.lastBlockhash;
	const greetedAccountBefore = await client.getAccount(greetedPubkey);
	t.assert(greetedAccountBefore != null);
	t.deepEqual(greetedAccountBefore?.data, new Uint8Array([0, 0, 0, 0]));
	const numIxs = 64;
	const ixs = Array(numIxs).fill(ix);
	let tx = new Transaction();
	tx.recentBlockhash = blockhash;
	tx.add(...ixs);
	tx.sign(payer);
	await client.processTransaction(tx);
	const greetedAccountAfter = await client.getAccount(greetedPubkey);
	t.assert(greetedAccountAfter != null);
	t.deepEqual(greetedAccountAfter?.data, new Uint8Array([64, 0, 0, 0]));
});

test("add program via setAccount", async (t) => {
	let [ctx, programId, greetedPubkey] = await helloworldProgramViaSetAccount();
	let client = ctx.banksClient;
	const payer = ctx.payer;
	const blockhash = ctx.lastBlockhash;
	const greetedAccountBefore = await client.getAccount(greetedPubkey);
	t.assert(greetedAccountBefore != null);
	t.deepEqual(greetedAccountBefore?.data, new Uint8Array([0, 0, 0, 0]));
	const ix = new TransactionInstruction({
		keys: [{ pubkey: greetedPubkey, isSigner: false, isWritable: true }],
		programId,
		data: Buffer.from([0]),
	});
	let tx = new Transaction();
	tx.recentBlockhash = blockhash;
	tx.add(ix);
	tx.sign(payer);
	await client.processTransaction(tx);
	const greetedAccountAfter = await client.getAccount(greetedPubkey);
	t.assert(greetedAccountAfter != null);
	t.deepEqual(greetedAccountAfter?.data, new Uint8Array([1, 0, 0, 0]));
});
