---
prev: /
next: /api/
---
# Tutorial

## Deploying programs

Most of the time we want to do more than just mess around with token transfers - 
we want to test our own programs. `solana-program-test` is a bit fussy about
how this is done.

Firstly, the program's `.so` file must be present in one of the following directories:

* `./tests/fixtures` (just create this directory if it doesn't exist)
* The current working directory
* A directory you define in the `BPF_OUT_DIR` or `SBF_OUT_DIR` environment variables.

(If you're not aware, the `.so` file is created when you run `anchor build` or `cargo build-sbf`
and can be found in `target/deploy`).

Now to add the program to our tests we use the `programs` parameter in the `start` function.
The program name used in this parameter must match the filename without the `.so` extension.

Here's an example using a [simple program](https://github.com/solana-labs/solana-program-library/tree/bd216c8103cd8eb9f5f32e742973e7afb52f3b81/examples/rust/logging)
from the Solana Program Library that just does some logging:

<<< @/tests/splLogging.test.ts

The `.so` file must be named `spl_example_logging.so`, since `spl_example_logging` is
the name we used in the `programs` parameter.

## Anchor integration

### Basic

If you have an Anchor workspace, `bankrun` can make some extra assumptions that make it more
convenient to get started. Just use `start_anchor` and give it the path to the project root
(the folder containing the `Anchor.toml` file). The programs in the workspace will be automatically
deployed to the test environment.

Example:

<<< @/tests/anchor-example/anchor.test.ts

### anchor-bankrun

If you want deeper Anchor integration, you can install the [anchor-bankrun](https://www.npmjs.com/package/anchor-bankrun) package. This allows you to write typical Anchor tests with minimal changes using the `BankrunProvider`
class. Here's an example that tests a program from the Anchor repository:

```typescript
import { startAnchor } from "solana-bankrun";
import { BankrunProvider } from "anchor-bankrun";
import { Keypair, PublicKey } from "@solana/web3.js";
import { BN, Program } from "@coral-xyz/anchor";
import { IDL as PuppetIDL, Puppet } from "./anchor-example/puppet";

const PUPPET_PROGRAM_ID = new PublicKey(
	"Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS",
);

test("anchor", async () => {
	const context = await startAnchor("tests/anchor-example", [], []);

	const provider = new BankrunProvider(context);

	const puppetProgram = new Program<Puppet>(
		PuppetIDL,
		PUPPET_PROGRAM_ID,
		provider,
	);

	const puppetKeypair = Keypair.generate();
	await puppetProgram.methods
		.initialize()
		.accounts({
			puppet: puppetKeypair.publicKey,
		})
		.signers([puppetKeypair])
		.rpc();

	const data = new BN(123456);
	await puppetProgram.methods
		.setData(data)
		.accounts({
			puppet: puppetKeypair.publicKey,
		})
		.rpc();

	const dataAccount = await puppetProgram.account.data.fetch(
		puppetKeypair.publicKey,
	);
	expect(dataAccount.data.eq(new BN(123456)));
});
```

## Time travel

Many programs rely on the `Clock` sysvar: for example, a mint that doesn't become available until after
a certain time. With `bankrun` you can dynamically overwrite the `Clock` sysvar using `context.set_clock()`.
Here's an example using a program that panics if `clock.unix_timestamp` is greater than 100
(which is on January 1st 1970):

<<< @/tests/clock-example/clock.test.ts

See also: `context.warp_to_slot()`, which lets you jump to a future slot.

## Writing arbitrary accounts

Bankrun lets you write any account data you want, regardless of
whether the account state would even be possible.

Here's an example where we give an account a bunch of USDC,
even though we don't have the USDC mint keypair. This is
convenient for testing because it means we don't have to
work with fake USDC in our tests:

<<< @/tests/usdcMint.test.ts

::: tip
If you want to set account data *after* calling `start()`,
you can use `context.set_account()`.
:::

### Copying Accounts from a live environment

If you don't want to initialize arbitray accounts manually you 
can also copy the account's data easily from a live environment 
and pass it to Bankrun.

Here's a simple example that pulls account data from devnet
and pass it to bankrun:

<<< @/tests/copyAccounts.test.ts

::: tip
Just like with manually setting accounts you can also
set the account data *after* calling `start()` using 
`context.set_account()`.
:::

## Other features

Other things you can do with `bankrun` include:

* Changing the max compute units with the `compute_max_units` parameter.
* Changing the transaction account lock limit with the `transaction_account_lock_limit` parameter.

## When should I use `solana-test-validator`?

While `bankrun` is faster and more convenient, it is also less like a real RPC node.
So `solana-test-validator` is still useful when you need to call RPC methods that `BanksServer`
doesn't support, or when you want to test something that depends on real-life validator behaviour
rather than just testing your program and client code.

In general though I would recommend using `bankrun` wherever possible, as it will make your life
much easier.

## Supported platforms

`bankrun` is supported on Linux x64 and MacOS targets, because this is what
`solana-program-test` runs on. If you find a platform that is not supported
but which can run `solana-program-test`, please open an issue.
