import { Clock, start } from "solana-bankrun";
import {
	appendTransactionMessageInstructions,
	createTransactionMessage,
	generateKeyPairSigner,
	IInstruction,
	pipe,
	setTransactionMessageFeePayerSigner,
	setTransactionMessageLifetimeUsingBlockhash,
	signTransactionMessageWithSigners,
} from "@solana/web3.js";

test("clock", async () => {
	const programId = await generateKeyPairSigner().then(x => x.address);
	const context = await start(
		[{ name: "bankrun_clock_example", programId }],
		[],
	);
	const client = context.banksClient;
	const payer = await context.payer;
	const [blockhash, lastValidBlockHeight] = await context.banksClient.getLatestBlockhash();
	const ixs: IInstruction[] = [
		{ programAddress: programId, accounts: [], data: Buffer.from("") },
	];
	const tx = await pipe(
		createTransactionMessage({ version: 0 }),
		x => appendTransactionMessageInstructions(ixs, x),
		x => setTransactionMessageFeePayerSigner(payer, x),
		x => setTransactionMessageLifetimeUsingBlockhash({ blockhash, lastValidBlockHeight }, x),
		x => signTransactionMessageWithSigners(x),
	);

	// this will fail because it's not January 1970 anymore
	await expect(client.processTransaction(tx)).rejects.toThrow(
		"Program failed to complete",
	);
	// so let's turn back time
	const currentClock = await client.getClock();
	context.setClock(
		new Clock(
			currentClock.slot,
			currentClock.epochStartTimestamp,
			currentClock.epoch,
			currentClock.leaderScheduleEpoch,
			50n,
		),
	);
	const ixs2: IInstruction[] = [
		{ programAddress: programId, accounts: [], data: Buffer.from("foobar") },
	];
	const tx2 = await pipe(
		createTransactionMessage({ version: 0 }),
		x => appendTransactionMessageInstructions(ixs2, x),
		x => setTransactionMessageFeePayerSigner(payer, x),
		x => setTransactionMessageLifetimeUsingBlockhash({ blockhash, lastValidBlockHeight }, x),
		x => signTransactionMessageWithSigners(x),
	);
	// now the transaction goes through
	await client.processTransaction(tx2);
});
