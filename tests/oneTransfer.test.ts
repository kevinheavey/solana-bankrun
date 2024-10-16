import { start } from "solana-bankrun";
import { appendTransactionMessageInstructions, createTransactionMessage, generateKeyPairSigner, lamports, pipe, setTransactionMessageFeePayerSigner, setTransactionMessageLifetimeUsingBlockhash, signTransactionMessageWithSigners } from "@solana/web3.js";
import { getTransferSolInstruction } from "@solana-program/system"

test("one transfer", async () => {
	const context = await start([], []);
	const client = context.banksClient;
	const payer = await context.payer;
	const receiver = await generateKeyPairSigner().then(x => x.address);
	const [blockhash, lastValidBlockHeight] = await client.getLatestBlockhash();
	const transferLamports = lamports(1_000_000n);
	const ixs = [
		getTransferSolInstruction({
			source: payer,
			destination: receiver,
			amount: transferLamports,
		}),
	];
	const tx = await pipe(
		createTransactionMessage({ version: 0 }),
		x => appendTransactionMessageInstructions(ixs, x),
		x => setTransactionMessageFeePayerSigner(payer, x),
		x => setTransactionMessageLifetimeUsingBlockhash({ blockhash, lastValidBlockHeight }, x),
		x => signTransactionMessageWithSigners(x),
	);
	await client.processTransaction(tx);
	const balanceAfter = await client.getBalance(receiver);
	expect(balanceAfter).toBe(transferLamports);
});
