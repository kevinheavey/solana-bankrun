import { start } from "solana-bankrun";
import { address, createSolanaRpc, getBase58Encoder } from "@solana/web3.js";

test("copy accounts from devnet", async () => {
	const usdcMint = address(
		"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
	);
	const rpc = createSolanaRpc("https://api.devnet.solana.com");
	const accountInfo = await rpc.getAccountInfo(usdcMint).send();

	const context = await start(
		[],
		[
			{
				address: usdcMint,
				info: {
					...accountInfo.value,
					data: new Uint8Array(getBase58Encoder().encode(accountInfo.value.data)),
				},
			},
		],
	);

	const client = context.banksClient;
	const rawAccount = await client.getAccount(usdcMint);
	expect(rawAccount).not.toBeNull();
});
