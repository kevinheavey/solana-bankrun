import {
	Commitment,
	getAddressDecoder,
	lamports,
	AccountInfoBase,
	getAddressEncoder,
	Address,
	Transaction,
	getTransactionEncoder,
	Signature,
	Blockhash,
	blockhash,
	getCompiledTransactionMessageEncoder,
	CompiledTransactionMessage,
	KeyPairSigner,
	createKeyPairSignerFromPrivateKeyBytes,
} from "@solana/web3.js";
import {
	Account,
	BanksClient as BanksClientInner,
	EpochSchedule,
	FeeRateGovernor,
	GenesisConfig as GenesisConfigInner,
	PohConfig,
	ProgramTestContext as ProgramTestContextInner,
	start as startInner,
	startAnchor as startAnchorInner,
	TransactionReturnData as TransactionReturnDataInner,
	BanksTransactionMeta as BanksTransactionMetaInner,
	BanksTransactionResultWithMeta as BanksTransactionResultWithMetaInner,
	TransactionStatus,
	Rent,
	Clock,
	CommitmentLevel,
	Inflation,
} from "./internal";
export {
	EpochSchedule,
	TransactionStatus,
	Rent,
	Clock,
	PohConfig,
	FeeRateGovernor,
} from "./internal";
import bs58 from "bs58";

export type AccountInfoBytes = AccountInfoBase & { data: Uint8Array };

function convertCommitment(c?: Commitment): CommitmentLevel | null {
	if (c != null) {
		switch (c) {
			case "processed":
				return CommitmentLevel.Processed;
			case "confirmed":
				return CommitmentLevel.Confirmed;
			case "finalized":
				return CommitmentLevel.Finalized;
			default:
				throw new Error(`Unrecognized commitment level: ${c}`);
		}
	}
}

function toAccountInfo(acc: Account): AccountInfoBytes {
	return {
		executable: acc.executable,
		owner: getAddressDecoder().decode(acc.owner),
		lamports: lamports(acc.lamports),
		data: acc.data,
		rentEpoch: acc.rentEpoch,
	};
}

function fromAccountInfo(acc: AccountInfoBytes): Account {
	const maybeRentEpoch = acc.rentEpoch;
	const rentEpoch = maybeRentEpoch || 0;
	return new Account(
		BigInt(acc.lamports),
		acc.data,
		new Uint8Array(getAddressEncoder().encode(acc.owner)),
		acc.executable,
		BigInt(rentEpoch),
	);
}

export class TransactionReturnData {
	constructor(inner: TransactionReturnDataInner) {
		this.inner = inner;
	}
	private inner: TransactionReturnDataInner;
	get programId(): Address {
		return getAddressDecoder().decode(this.inner.programId);
	}
	get data(): Uint8Array {
		return this.inner.data;
	}
}

/**
 * Transaction metadata.
 */
export class BanksTransactionMeta {
	constructor(inner: BanksTransactionMetaInner) {
		this.inner = inner;
	}
	private inner: BanksTransactionMetaInner;
	/** The log messages written during transaction execution. */
	get logMessages(): Array<string> {
		return this.inner.logMessages;
	}
	/** The transaction return data, if present. */
	get returnData(): TransactionReturnData | null {
		const inner = this.inner.returnData;
		if (!inner) return null;
		return new TransactionReturnData(inner);
	}
	/** The number of compute units consumed by the transaction. */
	get computeUnitsConsumed(): bigint {
		return this.inner.computeUnitsConsumed;
	}
}
/**
 * A transaction result. Contains transaction metadata, and the transaction error, if there is one.
 */
export class BanksTransactionResultWithMeta {
	constructor(inner: BanksTransactionResultWithMetaInner) {
		this.inner = inner;
	}
	private inner: BanksTransactionResultWithMetaInner;
	/** The transaction error info, if the transaction failed. */
	get result(): string | null {
		return this.inner.result;
	}
	/** The transaction metadata. */
	get meta(): BanksTransactionMeta | null {
		const inner = this.inner.meta;
		if (!inner) return null;
		return new BanksTransactionMeta(inner);
	}
}

export type ClusterType = "devnet" | "testnet" | "mainnet-beta" | "development";

export class GenesisConfig {
	constructor(inner: GenesisConfigInner) {
		this.inner = inner;
	}
	private inner: GenesisConfigInner;
	get creationTime(): number {
		return this.inner.creationTime;
	}
	get accounts(): Map<Address, AccountInfoBytes> {
		return new Map(
			this.inner.accounts.map((obj) => {
				return [getAddressDecoder().decode(obj.address), toAccountInfo(obj.account)];
			}),
		);
	}
	get nativeInstructionProcessors(): Array<[String, Address]> {
		return this.inner.nativeInstructionProcessors.map((obj) => [
			obj.stringVal,
			getAddressDecoder().decode(obj.pubkeyVal),
		]);
	}
	get rewardsPools(): Map<Address, AccountInfoBytes> {
		return new Map(
			this.inner.rewardsPools.map((obj) => {
				return [getAddressDecoder().decode(obj.address), toAccountInfo(obj.account)];
			}),
		);
	}
	get ticksPerSlot(): bigint {
		return this.inner.ticksPerSlot;
	}
	get pohConfig(): PohConfig {
		return this.inner.pohConfig;
	}
	get feeRateGovernor(): FeeRateGovernor {
		return this.inner.feeRateGovernor;
	}
	get rent(): Rent {
		return this.inner.rent;
	}
	get inflation(): Inflation {
		return this.inner.inflation;
	}
	get epochSchedule(): EpochSchedule {
		return this.inner.epochSchedule;
	}
	get clusterType(): ClusterType {
		return this.inner.clusterType as ClusterType;
	}
}

/**
 * A client for the ledger state, from the perspective of an arbitrary validator.
 *
 * The client is used to send transactions and query account data, among other things.
 * Use `start()` to initialize a BanksClient.
 */
export class BanksClient {
	constructor(inner: BanksClientInner) {
		this.inner = inner;
	}
	private inner: BanksClientInner;

	/**
	 * Return the account at the given address at the slot corresponding to the given
	 * commitment level. If the account is not found, None is returned.
	 * @param address - The account address to look up.
	 * @param commitment - The commitment to use.
	 * @returns The account object, if the account exists.
	 */
	async getAccount(
		address: Address,
		commitment?: Commitment,
	): Promise<AccountInfoBytes | null> {
		const inner = await this.inner.getAccount(
			new Uint8Array(getAddressEncoder().encode(address)),
			convertCommitment(commitment),
		);
		return inner === null ? null : toAccountInfo(inner);
	}

	/**
	 * Send a transaction and return immediately.
	 * @param tx - The transaction to send.
	 */
	async sendTransaction(tx: Transaction) {
		const serialized = getTransactionEncoder().encode(tx);
		await this.inner.sendVersionedTransaction(new Uint8Array(serialized));
	}

	/**
	 * Process a transaction and return the result with metadata.
	 * @param tx - The transaction to send.
	 * @returns The transaction result and metadata.
	 */
	async processTransaction(
		tx: Transaction,
	): Promise<BanksTransactionMeta> {
		const serialized = getTransactionEncoder().encode(tx);
		const inner = await this.inner.processVersionedTransaction(new Uint8Array(serialized));
		return new BanksTransactionMeta(inner);
	}

	/**
	 * Try to process a transaction and return the result with metadata.
	 *
	 * If the transaction errors, a JS error is not raised.
	 * Instead the returned object's `result` field will contain an error message.
	 *
	 * This makes it easier to process transactions that you expect to fail
	 * and make assertions about things like log messages.
	 *
	 * @param tx - The transaction to send.
	 * @returns The transaction result and metadata.
	 */
	async tryProcessTransaction(
		tx: Transaction,
	): Promise<BanksTransactionResultWithMeta> {
		const serialized = getTransactionEncoder().encode(tx);
		const inner = await this.inner.tryProcessVersionedTransaction(new Uint8Array(serialized));
		return new BanksTransactionResultWithMeta(inner);
	}

	/**
	 * Simulate a transaction at the given commitment level.
	 * @param tx - The transaction to simulate.
	 * @param commitment - The commitment to use.
	 * @returns The transaction simulation result.
	 */
	async simulateTransaction(
		tx: Transaction,
		commitment?: Commitment,
	): Promise<BanksTransactionResultWithMeta> {
		const serialized = getTransactionEncoder().encode(tx);
		const commitmentConverted = convertCommitment(commitment);
		const inner = await this.inner.simulateVersionedTransaction(new Uint8Array(serialized), commitmentConverted);
		return new BanksTransactionResultWithMeta(inner);
	}

	/**
	 * Return the status of a transaction with a signature matching the transaction's first signature.
	 *
	 * Return None if the transaction is not found, which may be because the
	 * blockhash was expired or the fee-paying account had insufficient funds to pay the
	 * transaction fee. Note that servers rarely store the full transaction history. This
	 * method may return None if the transaction status has been discarded.
	 *
	 * @param signature - The transaction signature (the first signature of the transaction).
	 * @returns The transaction status, if found.
	 */
	async getTransactionStatus(
		signature: Signature,
	): Promise<TransactionStatus | null> {
		const decodedSig = bs58.decode(signature);
		return await this.inner.getTransactionStatus(decodedSig);
	}

	/**
	 * Same as `getTransactionStatus`, but for multiple transactions.
	 * @param signatures - The transaction signatures.
	 * @returns The transaction statuses, if found.
	 */
	async getTransactionStatuses(
		signatures: Signature[],
	): Promise<(TransactionStatus | undefined | null)[]> {
		const decoded = signatures.map(bs58.decode);
		return await this.inner.getTransactionStatuses(decoded);
	}

	/**
	 * Get the slot that has reached the given commitment level (or the default commitment).
	 * @param commitment - The commitment to use.
	 * @returns The current slot.
	 */
	async getSlot(commitment?: Commitment): Promise<bigint> {
		return await this.inner.getSlot(convertCommitment(commitment));
	}

	/**
	 * Get the current block height.
	 * @param commitment - The commitment to use.
	 * @returns The current block height.
	 */
	async getBlockHeight(commitment?: Commitment): Promise<bigint> {
		return await this.inner.getBlockHeight(convertCommitment(commitment));
	}

	/**
	 * Get the cluster rent.
	 * @returns The rent object.
	 */
	async getRent(): Promise<Rent> {
		return await this.inner.getRent();
	}

	/**
	 * Get the cluster clock.
	 * @returns the clock object.
	 */
	async getClock(): Promise<Clock> {
		return await this.inner.getClock();
	}

	/**
	 * Return the balance in lamports of an account at the given address at the slot.
	 * @param address - The account to look up.
	 * @param commitment - The commitment to use.
	 * @returns The account balance in lamports.
	 */
	async getBalance(
		address: Address,
		commitment?: Commitment,
	): Promise<bigint> {
		return await this.inner.getBalance(
			new Uint8Array(getAddressEncoder().encode(address)),
			convertCommitment(commitment),
		);
	}

	/**
	 * Returns latest blockhash and last valid block height for given commitment level.
	 * @param commitment - The commitment to use.
	 * @returns The blockhash and last valid block height.
	 */
	async getLatestBlockhash(
		commitment?: Commitment,
	): Promise<[Blockhash, bigint] | null> {
		const inner = await this.inner.getLatestBlockhash(
			convertCommitment(commitment),
		);
		if (!inner) return null;
		return [blockhash(inner.blockhash), inner.lastValidBlockHeight];
	}

	/**
	 * Get the fee in lamports for a given message.
	 * @param msg - The message to check.
	 * @param commitment - The commitment to use.
	 * @returns The fee for the given message.
	 */
	async getFeeForMessage(
		msg: CompiledTransactionMessage,
		commitment?: Commitment,
	): Promise<bigint | null> {
		return await this.inner.getFeeForMessage(
			new Uint8Array(getCompiledTransactionMessageEncoder().encode(msg)),
			convertCommitment(commitment),
		);
	}
}

/**
 * The result of calling `start()`.
 *
 * Contains a BanksClient, a recent blockhash and a funded payer keypair.
 */
export class ProgramTestContext {
	constructor(inner: ProgramTestContextInner) {
		this.inner = inner;
	}
	private inner: ProgramTestContextInner;
	/** The client for this test. */
	get banksClient(): BanksClient {
		return new BanksClient(this.inner.banksClient);
	}
	/** A funded keypair for sending transactions. */
	get payer(): Promise<KeyPairSigner> {
		return createKeyPairSignerFromPrivateKeyBytes(this.inner.payer.slice(0, 32));
	}
	/** The last blockhash registered when the client was initialized. */
	get lastBlockhash(): Blockhash {
		return blockhash(this.inner.lastBlockhash);
	}
	/** The chain's genesis config. */
	get genesisConfig(): GenesisConfig {
		return new GenesisConfig(this.inner.genesisConfig);
	}
	/**
	 * Create or overwrite an account, subverting normal runtime checks.
	 *
	 * This method exists to make it easier to set up artificial situations
	 * that would be difficult to replicate by sending individual transactions.
	 * Beware that it can be used to create states that would not be reachable
	 * by sending transactions!
	 *
	 * @param address - The address to write to.
	 * @param account - The account object to write.
	 */
	setAccount(address: Address, account: AccountInfoBytes) {
		this.inner.setAccount(new Uint8Array(getAddressEncoder().encode(address)), fromAccountInfo(account));
	}
	/**
	 * Overwrite the clock sysvar.
	 * @param clock - The new clock object.
	 */
	setClock(clock: Clock) {
		this.inner.setClock(clock);
	}
	/**
	 * Overwrite the rent sysvar.
	 * @param rent - The new rent object.
	 */
	setRent(rent: Rent) {
		this.inner.setRent(rent);
	}
	/**
	 * Force the working bank ahead to a new slot.
	 * @param slot - The slot to warp to.
	 */
	warpToSlot(slot: bigint) {
		this.inner.warpToSlot(slot);
	}
	/**
	 * Force the working bank ahead to a new epoch.
	 * @param epoch - The epoch to warp to.
	 */
	warpToEpoch(epoch: bigint) {
		this.inner.warpToEpoch(epoch);
	}
}

export interface AddedProgram {
	name: string;
	programId: Address;
}

export interface AddedAccount {
	address: Address;
	info: AccountInfoBytes;
}

/**
 * Start a bankrun!
 *
 * This will spin up a BanksServer and a BanksClient,
 * deploy programs and add accounts as instructed.
 *
 * @param programs - An array of objects indicating which programs to deploy to the test environment. See the main bankrun docs for more explanation on how to add programs.
 * @param accounts - An array of objects indicating what data to write to the given addresses.
 * @param computeMaxUnits - Override the default compute unit limit for a transaction.
 * @param transactionAccountLockLimit - Override the default transaction account lock limit.
 * @param deactivateFeatures - A list of feature IDs (pubkeys) to deactivate.
 * @returns A container for stuff you'll need to send transactions and interact with the test environment.
 */
export async function start(
	programs: AddedProgram[],
	accounts: AddedAccount[],
	computeMaxUnits?: bigint,
	transactionAccountLockLimit?: bigint,
	deactivateFeatures?: Address[],
): Promise<ProgramTestContext> {
	const ctx = await startInner(
		programs.map((p) => [p.name, new Uint8Array(getAddressEncoder().encode(p.programId))]),
		accounts.map((a) => [new Uint8Array(getAddressEncoder().encode(a.address)), fromAccountInfo(a.info)]),
		computeMaxUnits,
		transactionAccountLockLimit,
		deactivateFeatures?.map((pk) => new Uint8Array(getAddressEncoder().encode(pk))) ?? [],
	);
	return new ProgramTestContext(ctx);
}

/**
 * Start a bankrun in an Anchor workspace, with all the workspace programs deployed.
 *
 * This will spin up a BanksServer and a BanksClient,
 * deploy programs and add accounts as instructed.
 *
 * @param path - Path to root of the Anchor project.
 * @param programs - An array of objects indicating extra programs to deploy to the test environment. See the main bankrun docs for more explanation on how to add programs.
 * @param accounts - An array of objects indicating what data to write to the given addresses.
 * @param computeMaxUnits - Override the default compute unit limit for a transaction.
 * @param transactionAccountLockLimit - Override the default transaction account lock limit.
 * @param deactivateFeatures - A list of feature IDs (pubkeys) to deactivate.
 * @returns A container for stuff you'll need to send transactions and interact with the test environment.
 */
export async function startAnchor(
	path: string,
	extraPrograms: AddedProgram[],
	accounts: AddedAccount[],
	computeMaxUnits?: bigint,
	transactionAccountLockLimit?: bigint,
	deactivateFeatures?: Address[],
): Promise<ProgramTestContext> {
	const ctx = await startAnchorInner(
		path,
		extraPrograms.map((p) => [p.name, new Uint8Array(getAddressEncoder().encode(p.programId))]),
		accounts.map((a) => [new Uint8Array(getAddressEncoder().encode(a.address)), fromAccountInfo(a.info)]),
		computeMaxUnits,
		transactionAccountLockLimit,
		deactivateFeatures?.map((pk) => new Uint8Array(getAddressEncoder().encode(pk))) ?? [],
	);
	return new ProgramTestContext(ctx);
}
