import { startAnchor } from "../../solana-bankrun";
import { PublicKey } from "@solana/web3.js";

test("anchor", async () => {
	const context = await startAnchor("tests/anchor-example", [], []);
	const programId = new PublicKey(
		"Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS",
	);
	const executableAccount = await context.banksClient.getAccount(programId);
	expect(executableAccount).not.toBeNull();
	expect(executableAccount?.executable).toBe(true);
});
