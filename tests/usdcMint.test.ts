import { start } from "solana-bankrun";
import { generateKeyPairSigner, address, lamports } from "@solana/web3.js";
import { findAssociatedTokenPda, getTokenDecoder, getTokenEncoder, TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";

test("infinite usdc mint", async () => {
	const owner = await generateKeyPairSigner().then(x => x.address);
	const usdcMint = address(
		"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
	);
	const ata = await findAssociatedTokenPda({
		mint: usdcMint,
		owner,
		tokenProgram: TOKEN_PROGRAM_ADDRESS,
	}).then(x => x[0]);
	const usdcToOwn = 1_000_000_000_000n;
	const tokenAccData = getTokenEncoder().encode({
		mint: usdcMint,
		owner,
		amount: usdcToOwn,
		delegate: null,
		delegatedAmount: 0n,
		state: 1,
		isNative: null,
		closeAuthority: null,
	});
	const context = await start(
		[],
		[
			{
				address: ata,
				info: {
					lamports: lamports(1_000_000_000n),
					data: new Uint8Array(tokenAccData),
					owner: TOKEN_PROGRAM_ADDRESS,
					executable: false,
					rentEpoch: 0n,
				},
			},
		],
	);
	const client = context.banksClient;
	const rawAccount = await client.getAccount(ata);
	expect(rawAccount).not.toBeNull();
	const rawAccountData = rawAccount?.data;
	const decoded = getTokenDecoder().decode(rawAccountData);
	expect(decoded.amount).toBe(usdcToOwn);
});
