import { start } from "solana-bankrun";
import { PublicKey } from "@solana/web3.js";

test("copy accounts from devnet", async () => {
	const owner = PublicKey.unique();
	const usdcMint = new PublicKey(
		"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
	);
  const connection = new Connection("https://api.devnet.solana.com");
  const accountInfo = await connection.getAccountInfo(usdcMint)
  
	const context = await start(
		[],
		[
			{
				address: usdcMint,
				info: accountInfo,
			},
		],
	);
  
	const client = context.banksClient;
	const rawAccount = await client.getAccount(usdcMint);
	expect(rawAccount).not.toBeNull();
});
