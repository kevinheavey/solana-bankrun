# Bankrun

`Bankrun` is a superfast, powerful and lightweight framework
for testing Solana programs in NodeJS.

While people often use `solana-test-validator` for this,
`bankrun` is orders of magnitude faster and far more convenient.
You don't have to
take care of an external process and you can start as many `bankrun`
instances as you like without worrying about ports in use or hogging your machine's resources.

You can also do things that are not possible with `solana-test-validator`,
such as jumping back and forth in time or dynamically setting account data.

If you've used [solana-program-test](https://crates.io/crates/solana-program-test)
you'll be familiar with `bankrun`, since that's what it uses under the hood.

For those unfamiliar, `bankrun` and `solana-program-test` work by spinning up a lightweight
`BanksServer` that's like an RPC node but much faster, and creating a `BanksClient` to talk to the
server. This author thought `solana-program-test` was a boring name, so he chose ``bankrun`` instead
(you're running Solana [Banks](https://github.com/solana-labs/solana/blob/master/runtime/src/bank.rs)).

## Minimal example

This example just transfers lamports from Alice to Bob without loading
any programs of our own. It uses the [ava](https://github.com/avajs/ava)
test runner but you can use any test runner you like.

Note: you should use the `--no-worker-threads` flag with ava, otherwise
your tests will likely crash for ava-specific reasons.

```ts
import test from "ava";
import { start } from "solana-bankrun";
import { PublicKey, Transaction, SystemProgram } from "@solana/web3.js";

test("one transfer", async (t) => {
	const context = await start([], []);
	const client = context.banksClient;
	const payer = context.payer;
	const receiver = PublicKey.unique();
	const blockhash = context.lastBlockhash;
	const transferLamports = 1_000_000n;
	const ixs = [
		SystemProgram.transfer({
			fromPubkey: payer.publicKey,
			toPubkey: receiver,
			lamports: transferLamports,
		}),
	];
	let tx = new Transaction();
	tx.recentBlockhash = blockhash;
	tx.add(...ixs);
	tx.sign(payer);
	await client.processTransaction(tx);
	const balanceAfter = await client.getBalance(receiver);
	t.deepEqual(balanceAfter, transferLamports);
});
```

Some things to note here:

* The `context` object contains a `banks_client` to talk to the `BanksServer`,
  a `payer` keypair that has been funded with a bunch of SOL, and a `last_blockhash`
  that we can use in our transactions.
* We haven't loaded any specific programs, but by default we have access to
  the System Program, the SPL token programs and the SPL memo program.


## Getting Started

NPM package is coming soon.

If you want to contribute, make sure you have Yarn and the Rust toolchain installed.

Then run `yarn` to install deps, run `yarn build` to build the binary and `yarn test` to run the tests.
