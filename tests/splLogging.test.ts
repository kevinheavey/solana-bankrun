import { start } from "solana-bankrun";
import { AccountRole, appendTransactionMessageInstructions, createTransactionMessage, generateKeyPairSigner, IInstruction, pipe, setTransactionMessageFeePayerSigner, setTransactionMessageLifetimeUsingBlockhash, signTransactionMessageWithSigners } from "@solana/web3.js";

test("spl logging", async () => {
	const programId = await generateKeyPairSigner().then(x => x.address);
	const context = await start([{ name: "spl_example_logging", programId }], []);
	const client = context.banksClient;
	const payer = await context.payer;
	const [blockhash, lastValidBlockHeight] = await client.getLatestBlockhash();
	const account = await generateKeyPairSigner().then(x => x.address);
	const ixs: IInstruction[] = [
		{ programAddress: programId, accounts: [
			{ address: account, role: AccountRole.WRITABLE },
		], data: Buffer.from("") },
	];
	const tx = await pipe(
		createTransactionMessage({ version: 0 }),
		x => appendTransactionMessageInstructions(ixs, x),
		x => setTransactionMessageFeePayerSigner(payer, x),
		x => setTransactionMessageLifetimeUsingBlockhash({ blockhash, lastValidBlockHeight }, x),
		x => signTransactionMessageWithSigners(x),
	);
	// let's sim it first
	const simRes = await client.simulateTransaction(tx);
	const meta = await client.processTransaction(tx);
	expect(simRes.meta?.logMessages).toEqual(meta?.logMessages);
	expect(meta.logMessages[1]).toBe("Program log: static string");
});
