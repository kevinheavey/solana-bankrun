import test from "ava";
import { start } from "../solana-bankrun";
import { PublicKey } from "@solana/web3.js";
import {
	getAssociatedTokenAddressSync,
	AccountLayout,
	ACCOUNT_SIZE,
} from "@solana/spl-token";

test("infinite usdc mint", async (t) => {
	const owner = PublicKey.unique();
	const usdcMint = new PublicKey(
		"EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
	);
	const ata = getAssociatedTokenAddressSync(usdcMint, owner, true);
	const usdcToOwn = 1_000_000_000_000n;
	const tokenAccData = Buffer.alloc(ACCOUNT_SIZE);
	AccountLayout.encode(
		{
			mint: usdcMint,
			owner,
			amount: usdcToOwn,
			delegateOption: 0,
			delegate: PublicKey.default,
			delegatedAmount: 0n,
			state: 1,
			isNativeOption: 0,
			isNative: 0n,
			closeAuthorityOption: 0,
			closeAuthority: PublicKey.default,
		},
		tokenAccData,
	);
	const context = await start(
		[],
		[
			{
				address: ata,
				info: {
					lamports: 1_000_000_000,
					data: tokenAccData,
					owner,
					executable: false,
				},
			},
		],
	);
	const client = context.banksClient;
	const rawAccount = await client.getAccount(ata);
	t.assert(rawAccount != null);
	const rawAccountData = rawAccount!.data;
	const decoded = AccountLayout.decode(rawAccountData);
	t.deepEqual(decoded.amount, usdcToOwn);
});
