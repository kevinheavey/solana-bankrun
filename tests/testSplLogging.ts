import test from "ava";
import { start } from "../solana-bankrun";
import {
	PublicKey,
	Transaction,
	TransactionInstruction,
} from "@solana/web3.js";

test("spl logging", async (t) => {
	const programId = PublicKey.unique();
	const context = await start([{ name: "spl_example_logging", programId }], []);
	const client = context.banksClient;
	const payer = context.payer;
	const blockhash = context.lastBlockhash;
	const ixs = [
		new TransactionInstruction({
			programId,
			keys: [
				{ pubkey: PublicKey.unique(), isSigner: false, isWritable: false },
			],
		}),
	];
	let tx = new Transaction();
	tx.recentBlockhash = blockhash;
	tx.add(...ixs);
	tx.sign(payer);
	// let's sim it first
	const simRes = await client.simulateTransaction(tx);
	const meta = await client.processTransaction(tx);
	t.deepEqual(simRes.meta?.logMessages, meta?.logMessages);
	t.deepEqual(meta.logMessages[1], "Program log: static string");
});
