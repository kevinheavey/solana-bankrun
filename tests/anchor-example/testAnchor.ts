import test from "ava";
import { startAnchor } from "../../solana-bankrun";
import { PublicKey } from "@solana/web3.js";

test("anchor", async (t) => {
	const context = await startAnchor("tests/anchor-example", [], []);
	const programId = new PublicKey(
		"Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS",
	);
	const executableAccount = await context.banksClient.getAccount(programId);
	t.assert(executableAccount != null);
	t.assert(executableAccount?.executable);
});
