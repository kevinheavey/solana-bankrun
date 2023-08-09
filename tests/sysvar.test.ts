import { start, Rent, Clock } from "../solana-bankrun";

test("sysvar", async () => {
	let ctx = await start([], []);
	let client = ctx.banksClient;
	const rentBefore = await client.getRent();
	expect(rentBefore.burnPercent).toBe(50);
	expect(rentBefore.minimumBalance(123n)).toBe(1746960n);
	const newRent = new Rent(
		rentBefore.lamportsPerByteYear,
		rentBefore.exemptionThreshold,
		0,
	);
	ctx.setRent(newRent);
	const rentAfter = await client.getRent();
	expect(rentAfter.burnPercent).toBe(0);
	const clockBefore = await client.getClock();
	expect(clockBefore.epoch).toBe(0n);
	const newClock = new Clock(1000n, 1n, 100n, 3n, 4n);
	ctx.setClock(newClock);
	const clockAfter = await client.getClock();
	expect(clockAfter.epoch).toBe(newClock.epoch);
	// see that setting the clock sysvar doesn't change the result of get_slot
	const slot = await client.getSlot();
	expect(slot).toBe(1n);
});
