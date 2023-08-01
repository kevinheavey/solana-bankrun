import test from "ava";
import { start, Rent, Clock } from "../solana-bankrun";

test("sysvar", async (t) => {
	let ctx = await start([], []);
	let client = ctx.banksClient;
	const rentBefore = await client.getRent();
	t.deepEqual(rentBefore.burnPercent, 50);
	t.deepEqual(rentBefore.minimumBalance(123n), 1746960n);
	const newRent = new Rent(
		rentBefore.lamportsPerByteYear,
		rentBefore.exemptionThreshold,
		0,
	);
	ctx.setRent(newRent);
	const rentAfter = await client.getRent();
	t.deepEqual(rentAfter.burnPercent, 0);
	const clockBefore = await client.getClock();
	t.deepEqual(clockBefore.epoch, 0n);
	const newClock = new Clock(1000n, 1n, 100n, 3n, 4n);
	ctx.setClock(newClock);
	const clockAfter = await client.getClock();
	t.deepEqual(clockAfter.epoch, newClock.epoch);
	// see that setting the clock sysvar doesn't change the result of get_slot
	const slot = await client.getSlot();
	t.deepEqual(slot, 1n);
});
