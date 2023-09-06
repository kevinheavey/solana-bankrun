#![allow(clippy::missing_safety_doc)]
use std::path::PathBuf;
use std::str::FromStr;

use bincode::deserialize;
use derive_more::{From, Into};
use napi::bindgen_prelude::*;
use solana_banks_client::TransactionStatus as TransactionStatusBanks;
use solana_banks_interface::{
    BanksTransactionResultWithMetadata, BanksTransactionResultWithSimulation,
    TransactionConfirmationStatus as TransactionConfirmationStatusBanks, TransactionMetadata,
};
use solana_program::{
    clock::Clock as ClockOriginal,
    epoch_schedule::EpochSchedule as EpochScheduleOriginal,
    fee_calculator::FeeRateGovernor as FeeRateGovernorOriginal,
    message::Message,
    pubkey::Pubkey,
    rent::{Rent as RentOriginal, RentDue},
};
use solana_program_test::{
    BanksClient as BanksClientOriginal, BanksClientError, ProgramTest,
    ProgramTestContext as ProgramTestContextOriginal,
};
use solana_sdk::{
    account::{Account as AccountOriginal, AccountSharedData},
    commitment_config::CommitmentLevel as CommitmentLevelOriginal,
    genesis_config::{ClusterType, GenesisConfig as GenesisConfigOriginal},
    inflation::Inflation as InflationOriginal,
    poh_config::PohConfig as PohConfigOriginal,
    signature::Signature,
    transaction::{Transaction, TransactionError, VersionedTransaction},
    transaction_context::TransactionReturnData as TransactionReturnDataOriginal,
};
use solana_transaction_status::{
    TransactionConfirmationStatus, TransactionStatus as TransactionStatusOriginal,
};
use tarpc::context::current;
use toml::Table;

#[macro_use]
extern crate napi_derive;

fn convert_pubkey(address: Uint8Array) -> Pubkey {
    Pubkey::try_from(address.as_ref()).unwrap()
}

#[napi]
pub enum CommitmentLevel {
    Processed,
    Confirmed,
    Finalized,
}

impl Default for CommitmentLevel {
    fn default() -> Self {
        Self::Confirmed
    }
}

impl From<CommitmentLevel> for CommitmentLevelOriginal {
    fn from(value: CommitmentLevel) -> Self {
        match value {
            CommitmentLevel::Processed => Self::Processed,
            CommitmentLevel::Confirmed => Self::Confirmed,
            CommitmentLevel::Finalized => Self::Finalized,
        }
    }
}

#[derive(Debug, From, Into, Clone)]
#[napi]
pub struct Account(AccountOriginal);

impl AsRef<AccountOriginal> for Account {
    fn as_ref(&self) -> &AccountOriginal {
        &self.0
    }
}

#[napi]
impl Account {
    #[napi(constructor)]
    pub fn new(
        lamports: BigInt,
        data: Uint8Array,
        owner: Uint8Array,
        executable: bool,
        rent_epoch: BigInt,
    ) -> Self {
        AccountOriginal {
            lamports: lamports.get_u64().1,
            data: data.to_vec(),
            owner: Pubkey::try_from(owner.as_ref()).unwrap(),
            executable,
            rent_epoch: rent_epoch.get_u64().1,
        }
        .into()
    }

    #[napi(getter)]
    pub fn lamports(&self) -> u64 {
        self.0.lamports
    }

    #[napi(getter)]
    pub fn data(&self) -> Uint8Array {
        Uint8Array::new(self.0.data.clone())
    }

    #[napi(getter)]
    pub fn owner(&self) -> Uint8Array {
        Uint8Array::new(self.0.owner.to_bytes().to_vec())
    }

    #[napi(getter)]
    pub fn executable(&self) -> bool {
        self.0.executable
    }

    #[napi(getter)]
    pub fn rent_epoch(&self) -> u64 {
        self.0.rent_epoch
    }
}

#[derive(Debug, Clone)]
#[napi]
pub struct BlockhashRes {
    pub blockhash: String,
    pub last_valid_block_height: BigInt,
}

#[derive(Debug, From, Into, Clone)]
#[napi]
pub struct TransactionStatus(TransactionStatusOriginal);

#[napi]
impl TransactionStatus {
    fn new(
        slot: u64,
        confirmations: Option<usize>,
        err: Option<TransactionError>,
        confirmation_status: Option<TransactionConfirmationStatus>,
    ) -> Self {
        TransactionStatusOriginal {
            slot,
            confirmations,
            status: Ok(()),
            err: err.map(Into::into),
            confirmation_status: confirmation_status.map(Into::into),
        }
        .into()
    }

    #[napi(getter)]
    pub fn slot(&self) -> u64 {
        self.0.slot
    }

    #[napi(getter)]
    pub fn confirmations(&self) -> Option<usize> {
        self.0.confirmations
    }

    #[napi(getter)]
    pub fn err(&self) -> Option<String> {
        self.0.err.clone().map(|x| x.to_string())
    }

    #[napi(getter)]
    pub fn confirmation_status(&self) -> Option<String> {
        self.0
            .confirmation_status
            .clone()
            .map(|x| serde_json::to_string(&x).unwrap())
    }
}

#[derive(Debug, From, Into, Clone)]
#[napi]
pub struct TransactionReturnData(TransactionReturnDataOriginal);

#[napi]
impl TransactionReturnData {
    #[napi(getter)]
    pub fn program_id(&self) -> Uint8Array {
        Uint8Array::new(self.0.program_id.to_bytes().to_vec())
    }

    #[napi(getter)]
    pub fn data(&self) -> Uint8Array {
        Uint8Array::new(self.0.data.clone())
    }
}

#[derive(Debug, From, Into, Clone)]
#[napi]
pub struct BanksTransactionMeta(TransactionMetadata);

#[napi]
impl BanksTransactionMeta {
    #[napi(getter)]
    pub fn log_messages(&self) -> Vec<String> {
        self.0.log_messages.clone()
    }

    #[napi(getter)]
    pub fn return_data(&self) -> Option<TransactionReturnData> {
        self.0.return_data.clone().map(Into::into)
    }

    #[napi(getter)]
    pub fn compute_units_consumed(&self) -> u64 {
        self.0.compute_units_consumed
    }
}

#[derive(Debug, From, Into, Clone)]
#[napi]
pub struct BanksTransactionResultWithMeta(BanksTransactionResultWithMetadata);

#[napi]
impl BanksTransactionResultWithMeta {
    #[napi(getter)]
    pub fn result(&self) -> Option<String> {
        match self.0.result.clone() {
            Ok(()) => None,
            Err(x) => Some(x.to_string()),
        }
    }

    #[napi(getter)]
    pub fn meta(&self) -> Option<BanksTransactionMeta> {
        self.0.metadata.clone().map(Into::into)
    }
}

impl From<BanksTransactionResultWithSimulation> for BanksTransactionResultWithMeta {
    fn from(r: BanksTransactionResultWithSimulation) -> Self {
        BanksTransactionResultWithMetadata {
            result: match r.result {
                None => Ok(()),
                Some(x) => x,
            },
            metadata: r.simulation_details.map(|d| TransactionMetadata {
                log_messages: d.logs,
                compute_units_consumed: d.units_consumed,
                return_data: d.return_data,
            }),
        }
        .into()
    }
}

#[derive(From, Into)]
#[napi]
pub struct BanksClient(BanksClientOriginal);

fn to_js_error(e: BanksClientError, msg: &str) -> Error {
    Error::new(Status::GenericFailure, format!("{msg}: {e}"))
}

fn confirmation_status_from_banks(
    s: TransactionConfirmationStatusBanks,
) -> TransactionConfirmationStatus {
    match s {
        TransactionConfirmationStatusBanks::Processed => TransactionConfirmationStatus::Processed,
        TransactionConfirmationStatusBanks::Confirmed => TransactionConfirmationStatus::Confirmed,
        TransactionConfirmationStatusBanks::Finalized => TransactionConfirmationStatus::Finalized,
    }
}

fn transaction_status_from_banks(t: TransactionStatusBanks) -> TransactionStatus {
    TransactionStatus::new(
        t.slot,
        t.confirmations,
        t.err.map(Into::into),
        t.confirmation_status.map(confirmation_status_from_banks),
    )
}

#[napi]
impl BanksClient {
    #[napi]
    pub async unsafe fn get_account(
        &mut self,
        address: Uint8Array,
        commitment: Option<CommitmentLevel>,
    ) -> Result<Option<Account>> {
        let pk = convert_pubkey(address);
        let res = self
            .0
            .get_account_with_commitment(pk, commitment.unwrap_or_default().into())
            .await;
        match res {
            Ok(x) => Ok(x.map(Into::into)),
            Err(e) => Err(to_js_error(e, "Failed to load account")),
        }
    }

    #[napi]
    pub async unsafe fn send_legacy_transaction(&mut self, tx_bytes: Uint8Array) -> Result<()> {
        let tx: Transaction = deserialize(&tx_bytes).unwrap();
        let res = self.0.send_transaction(tx).await;
        res.map_err(|e| to_js_error(e, "Failed to process transaction"))
    }

    #[napi]
    pub async unsafe fn send_versioned_transaction(&mut self, tx_bytes: Uint8Array) -> Result<()> {
        let tx: VersionedTransaction = deserialize(&tx_bytes).unwrap();
        let res = self.0.send_transaction(tx).await;
        res.map_err(|e| to_js_error(e, "Failed to process transaction"))
    }

    #[napi]
    pub async unsafe fn process_legacy_transaction(
        &mut self,
        tx_bytes: Uint8Array,
    ) -> Result<BanksTransactionMeta> {
        let tx: Transaction = deserialize(&tx_bytes).unwrap();
        let res = self.0.process_transaction_with_metadata(tx).await;
        match res {
            Ok(r) => match r.result {
                Err(e) => Err(to_js_error(
                    BanksClientError::TransactionError(e),
                    "Failed to process transaction",
                )),
                Ok(()) => Ok(BanksTransactionMeta::from(r.metadata.unwrap())),
            },
            Err(e) => Err(to_js_error(e, "Failed to process transaction")),
        }
    }

    #[napi]
    pub async unsafe fn process_versioned_transaction(
        &mut self,
        tx_bytes: Uint8Array,
    ) -> Result<BanksTransactionMeta> {
        let tx: VersionedTransaction = deserialize(&tx_bytes).unwrap();
        let res = self.0.process_transaction_with_metadata(tx).await;
        match res {
            Ok(r) => match r.result {
                Err(e) => Err(to_js_error(
                    BanksClientError::TransactionError(e),
                    "Failed to process transaction",
                )),
                Ok(()) => Ok(BanksTransactionMeta::from(r.metadata.unwrap())),
            },
            Err(e) => Err(to_js_error(e, "Failed to process transaction")),
        }
    }

    #[napi]
    pub async unsafe fn try_process_legacy_transaction(
        &mut self,
        tx_bytes: Uint8Array,
    ) -> Result<BanksTransactionResultWithMeta> {
        let tx: Transaction = deserialize(&tx_bytes).unwrap();
        let res = self.0.process_transaction_with_metadata(tx).await;
        match res {
            Ok(r) => Ok(r.into()),
            Err(e) => Err(to_js_error(e, "Failed to process transaction")),
        }
    }

    #[napi]
    pub async unsafe fn try_process_versioned_transaction(
        &mut self,
        tx_bytes: Uint8Array,
    ) -> Result<BanksTransactionResultWithMeta> {
        let tx: VersionedTransaction = deserialize(&tx_bytes).unwrap();
        let res = self.0.process_transaction_with_metadata(tx).await;
        match res {
            Ok(r) => Ok(r.into()),
            Err(e) => Err(to_js_error(e, "Failed to process transaction")),
        }
    }

    #[napi]
    pub async unsafe fn simulate_legacy_transaction(
        &mut self,
        tx_bytes: Uint8Array,
        commitment: Option<CommitmentLevel>,
    ) -> Result<BanksTransactionResultWithMeta> {
        let tx: Transaction = deserialize(&tx_bytes).unwrap();
        let res = self
            .0
            .simulate_transaction_with_commitment(tx, commitment.unwrap_or_default().into())
            .await;
        match res {
            Ok(x) => Ok(x.into()),
            Err(e) => Err(to_js_error(e, "Failed to simulate transaction")),
        }
    }

    #[napi]
    pub async unsafe fn simulate_versioned_transaction(
        &mut self,
        tx_bytes: Uint8Array,
        commitment: Option<CommitmentLevel>,
    ) -> Result<BanksTransactionResultWithMeta> {
        let tx: VersionedTransaction = deserialize(&tx_bytes).unwrap();
        let res = self
            .0
            .simulate_transaction_with_commitment(tx, commitment.unwrap_or_default().into())
            .await;
        match res {
            Ok(x) => Ok(x.into()),
            Err(e) => Err(to_js_error(e, "Failed to simulate transaction")),
        }
    }

    #[napi]
    pub async unsafe fn get_transaction_status(
        &mut self,
        signature: Uint8Array,
    ) -> Result<Option<TransactionStatus>> {
        let sig = Signature::try_from(signature.as_ref()).unwrap();
        let res = self.0.get_transaction_status(sig).await;
        match res {
            Ok(x) => Ok(x.map(transaction_status_from_banks)),
            Err(e) => Err(to_js_error(e, "Failed to get transaction status.")),
        }
    }

    #[napi]
    pub async unsafe fn get_transaction_statuses(
        &mut self,
        signatures: Vec<Uint8Array>,
    ) -> Result<Vec<Option<TransactionStatus>>> {
        let sigs: Vec<Signature> = signatures
            .into_iter()
            .map(|s| Signature::try_from(s.as_ref()).unwrap())
            .collect();
        let res = self.0.get_transaction_statuses(sigs).await;
        match res {
            Ok(x) => Ok(x
                .iter()
                .map(|o| o.clone().map(transaction_status_from_banks))
                .collect()),
            Err(e) => Err(to_js_error(e, "Failed to get transaction statuses.")),
        }
    }

    #[napi]
    pub async unsafe fn get_slot(&mut self, commitment: Option<CommitmentLevel>) -> Result<u64> {
        let res = self
            .0
            .get_slot_with_context(current(), commitment.unwrap_or_default().into())
            .await;
        res.map_err(|e| to_js_error(e, "Failed to get slot"))
    }

    #[napi]
    pub async unsafe fn get_block_height(
        &mut self,
        commitment: Option<CommitmentLevel>,
    ) -> Result<u64> {
        let res = self
            .0
            .get_block_height_with_context(current(), commitment.unwrap_or_default().into())
            .await;
        res.map_err(|e| to_js_error(e, "Failed to get block height"))
    }

    #[napi]
    pub async unsafe fn get_rent(&mut self) -> Result<Rent> {
        let res = self.0.get_rent().await;
        match res {
            Ok(x) => Ok(x.into()),
            Err(e) => Err(to_js_error(e, "Failed to get rent")),
        }
    }

    #[napi]
    pub async unsafe fn get_clock(&mut self) -> Result<Clock> {
        let res = self.0.get_sysvar::<ClockOriginal>().await;
        match res {
            Ok(x) => Ok(x.into()),
            Err(e) => Err(to_js_error(e, "Failed to get clock")),
        }
    }

    #[napi]
    pub async unsafe fn get_balance(
        &mut self,
        address: Uint8Array,
        commitment: Option<CommitmentLevel>,
    ) -> Result<u64> {
        let res = self
            .0
            .get_balance_with_commitment(
                convert_pubkey(address),
                commitment.unwrap_or_default().into(),
            )
            .await;
        res.map_err(|e| to_js_error(e, "Failed to get balance"))
    }

    #[napi]
    pub async unsafe fn get_latest_blockhash(
        &mut self,
        commitment: Option<CommitmentLevel>,
    ) -> Result<Option<BlockhashRes>> {
        let res = self
            .0
            .get_latest_blockhash_with_commitment(commitment.unwrap_or_default().into())
            .await;
        match res {
            Ok(x) => Ok(x.map(|tup| BlockhashRes {
                blockhash: tup.0.to_string(),
                last_valid_block_height: BigInt::from(tup.1),
            })),
            Err(e) => Err(to_js_error(e, "Failed to get latest blockhash")),
        }
    }

    #[napi]
    pub async unsafe fn get_fee_for_message(
        &mut self,
        message_bytes: Uint8Array,
        commitment: Option<CommitmentLevel>,
    ) -> Result<Option<u64>> {
        let msg: Message = bincode::deserialize(message_bytes.as_ref()).unwrap();
        let res = self
            .0
            .get_fee_for_message_with_commitment_and_context(
                current(),
                msg,
                commitment.unwrap_or_default().into(),
            )
            .await;
        res.map_err(|e| to_js_error(e, "Failed to get latest blockhash"))
    }
}

/// Configuration of network rent.
#[derive(From, Into, Default)]
#[napi]
pub struct Rent(RentOriginal);

#[napi]
impl Rent {
    /// @param lamportsPerByteYear - Rental rate in lamports/byte-year.
    /// @param exemptionThreshold - Amount of time (in years) a balance must include rent for the account to be rent exempt.
    /// @param burnPercent - The percentage of collected rent that is burned.
    #[napi(constructor)]
    pub fn new(lamports_per_byte_year: BigInt, exemption_threshold: f64, burn_percent: u8) -> Self {
        RentOriginal {
            lamports_per_byte_year: lamports_per_byte_year.get_u64().1,
            exemption_threshold,
            burn_percent,
        }
        .into()
    }

    #[napi(factory, js_name = "default")]
    pub fn new_default() -> Self {
        Self::default()
    }

    /// Rental rate in lamports/byte-year.
    #[napi(getter)]
    pub fn lamports_per_byte_year(&self) -> u64 {
        self.0.lamports_per_byte_year
    }

    /// Amount of time (in years) a balance must include rent for the account to be rent exempt.
    #[napi(getter)]
    pub fn exemption_threshold(&self) -> f64 {
        self.0.exemption_threshold
    }

    /// The percentage of collected rent that is burned.
    #[napi(getter)]
    pub fn burn_percent(&self) -> u8 {
        self.0.burn_percent
    }

    /// Calculate how much rent to burn from the collected rent.
    ///
    /// The first value returned is the amount burned. The second is the amount
    /// to distribute to validators.
    ///
    /// @param rentCollected: The amount of rent collected.
    /// @returns The amount burned and the amount to distribute to validators.
    #[napi]
    pub fn calculate_burn(&self, env: Env, rent_collected: BigInt) -> Array {
        let mut arr = env.create_array(2).unwrap();
        let res = self.0.calculate_burn(rent_collected.get_u64().1);
        arr.insert(res.0).unwrap();
        arr.insert(res.1).unwrap();
        arr
    }

    /// Minimum balance due for rent-exemption of a given account data size.
    ///
    /// Note: a stripped-down version of this calculation is used in
    /// ``calculate_split_rent_exempt_reserve`` in the stake program. When this
    /// function is updated, eg. when making rent variable, the stake program
    /// will need to be refactored.
    ///
    /// @param dataLen - The account data size.
    /// @returns The minimum balance due.
    #[napi]
    pub fn minimum_balance(&self, data_len: BigInt) -> u64 {
        self.0.minimum_balance(data_len.get_u64().1 as usize)
    }

    /// Whether a given balance and data length would be exempt.
    #[napi]
    pub fn is_exempt(&self, balance: BigInt, data_len: BigInt) -> bool {
        self.0
            .is_exempt(balance.get_u64().1, data_len.get_u64().1 as usize)
    }

    /// Rent due on account's data length with balance.
    ///
    /// @param balance - The account balance.
    /// @param dataLen - The account data length.
    /// @param yearsElapsed - Time elapsed in years.
    /// @returns The rent due.
    #[napi]
    pub fn due(&self, balance: BigInt, data_len: BigInt, years_elapsed: f64) -> Option<u64> {
        match self.0.due(
            balance.get_u64().1,
            data_len.get_u64().1 as usize,
            years_elapsed,
        ) {
            RentDue::Exempt => None,
            RentDue::Paying(x) => Some(x),
        }
    }

    /// Rent due for account that is known to be not exempt.
    ///
    /// @param dataLen - The account data length.
    /// @param yearsElapsed - Time elapsed in years.
    /// @returns The amount due.
    #[napi]
    pub fn due_amount(&self, data_len: BigInt, years_elapsed: f64) -> u64 {
        self.0
            .due_amount(data_len.get_u64().1 as usize, years_elapsed)
    }

    /// Creates a `Rent` that charges no lamports.
    ///
    /// This is used for testing.
    ///
    #[napi(factory)]
    pub fn free() -> Self {
        RentOriginal::free().into()
    }

    /// Creates a `Rent` that is scaled based on the number of slots in an epoch.
    ///
    /// This is used for testing.
    #[napi(factory)]
    pub fn with_slots_per_epoch(slots_per_epoch: BigInt) -> Self {
        RentOriginal::with_slots_per_epoch(slots_per_epoch.get_u64().1).into()
    }
}

/// A representation of network time.
///
/// All members of `Clock` start from 0 upon network boot.
#[derive(From, Into, Default)]
#[napi]
pub struct Clock(ClockOriginal);

#[napi]
impl Clock {
    /// @param slot - The current Slot.
    /// @param epochStartTimestamp - The timestamp of the first `Slot` in this `Epoch`.
    /// @param epoch - The current epoch.
    /// @param leaderScheduleEpoch - The future Epoch for which the leader schedule has most recently been calculated.
    /// @param unixTimestamp - The approximate real world time of the current slot.
    #[napi(constructor)]
    pub fn new(
        slot: BigInt,
        epoch_start_timestamp: BigInt,
        epoch: BigInt,
        leader_schedule_epoch: BigInt,
        unix_timestamp: BigInt,
    ) -> Self {
        ClockOriginal {
            slot: slot.get_u64().1,
            epoch_start_timestamp: epoch_start_timestamp.get_i64().0,
            epoch: epoch.get_u64().1,
            leader_schedule_epoch: leader_schedule_epoch.get_u64().1,
            unix_timestamp: unix_timestamp.get_i64().0,
        }
        .into()
    }

    /// The current Slot.
    #[napi(getter)]
    pub fn slot(&self) -> u64 {
        self.0.slot
    }

    /// The current epoch.
    #[napi(getter)]
    pub fn epoch(&self) -> u64 {
        self.0.epoch
    }

    /// The timestamp of the first `Slot` in this `Epoch`.
    #[napi(getter)]
    pub fn epoch_start_timestamp(&self) -> BigInt {
        BigInt::from(self.0.epoch_start_timestamp)
    }

    /// The future Epoch for which the leader schedule has most recently been calculated.
    #[napi(getter)]
    pub fn leader_schedule_epoch(&self) -> u64 {
        self.0.leader_schedule_epoch
    }

    /// The approximate real world time of the current slot.
    #[napi(getter)]
    pub fn unix_timestamp(&self) -> BigInt {
        BigInt::from(self.0.unix_timestamp)
    }
}

#[derive(From, Into)]
#[napi]
pub struct PohConfig(PohConfigOriginal);

#[napi]
impl PohConfig {
    #[napi(getter)]
    pub fn target_tick_duration(&self) -> u128 {
        self.0.target_tick_duration.as_micros()
    }
    #[napi(getter)]
    pub fn target_tick_count(&self) -> Option<u64> {
        self.0.target_tick_count
    }
    #[napi(getter)]
    pub fn hashes_per_tick(&self) -> Option<u64> {
        self.0.hashes_per_tick
    }
}

#[derive(From, Into)]
#[napi]
pub struct FeeRateGovernor(FeeRateGovernorOriginal);

#[napi]
impl FeeRateGovernor {
    #[napi(getter)]
    pub fn lamports_per_signature(&self) -> u64 {
        self.0.lamports_per_signature
    }
    #[napi(getter)]
    pub fn target_lamports_per_signature(&self) -> u64 {
        self.0.target_lamports_per_signature
    }
    #[napi(getter)]
    pub fn target_signatures_per_slot(&self) -> u64 {
        self.0.target_signatures_per_slot
    }
    #[napi(getter)]
    pub fn min_lamports_per_signature(&self) -> u64 {
        self.0.min_lamports_per_signature
    }
    #[napi(getter)]
    pub fn max_lamports_per_signature(&self) -> u64 {
        self.0.max_lamports_per_signature
    }
    #[napi(getter)]
    pub fn burn_percent(&self) -> u8 {
        self.0.burn_percent
    }
}

#[derive(From, Into)]
#[napi]
pub struct Inflation(InflationOriginal);

#[napi]
impl Inflation {
    #[napi(getter)]
    pub fn initial(&self) -> f64 {
        self.0.initial
    }
    #[napi(getter)]
    pub fn terminal(&self) -> f64 {
        self.0.terminal
    }
    #[napi(getter)]
    pub fn taper(&self) -> f64 {
        self.0.taper
    }
    #[napi(getter)]
    pub fn foundation(&self) -> f64 {
        self.0.foundation
    }
    #[napi(getter)]
    pub fn foundation_term(&self) -> f64 {
        self.0.foundation_term
    }
}

#[derive(From, Into)]
#[napi]
pub struct EpochSchedule(EpochScheduleOriginal);

#[napi]
impl EpochSchedule {
    #[napi(getter)]
    pub fn slots_per_epoch(&self) -> u64 {
        self.0.slots_per_epoch
    }
    #[napi(getter)]
    pub fn leader_schedule_slot_offset(&self) -> u64 {
        self.0.leader_schedule_slot_offset
    }
    #[napi(getter)]
    pub fn warmup(&self) -> bool {
        self.0.warmup
    }
    #[napi(getter)]
    pub fn first_normal_epoch(&self) -> u64 {
        self.0.first_normal_epoch
    }
    #[napi(getter)]
    pub fn first_normal_slot(&self) -> u64 {
        self.0.first_normal_slot
    }
}

#[derive(From, Into)]
#[napi]
pub struct AddressAndAccount {
    pub address: Uint8Array,
    account: Account,
}

#[napi]
impl AddressAndAccount {
    #[napi(getter)]
    pub fn account(&self) -> Account {
        self.account.clone()
    }
}

#[derive(From, Into)]
#[napi]
pub struct NativeInstructionProcessor {
    pub string_val: String,
    pub pubkey_val: Uint8Array,
}

#[derive(From, Into)]
#[napi]
pub struct GenesisConfig(GenesisConfigOriginal);

#[napi]
impl GenesisConfig {
    #[napi(getter)]
    pub fn creation_time(&self) -> i64 {
        self.0.creation_time
    }
    #[napi(getter)]
    pub fn accounts(&self) -> Vec<AddressAndAccount> {
        self.0
            .accounts
            .clone()
            .into_iter()
            .map(|(pk, acc)| AddressAndAccount {
                address: Uint8Array::from(pk.to_bytes()),
                account: Account::from(acc),
            })
            .collect()
    }
    #[napi(getter)]
    pub fn native_instruction_processors(&self) -> Vec<NativeInstructionProcessor> {
        self.0
            .native_instruction_processors
            .clone()
            .into_iter()
            .map(|tup| NativeInstructionProcessor {
                string_val: tup.0,
                pubkey_val: Uint8Array::from(tup.1.to_bytes()),
            })
            .collect()
    }
    #[napi(getter)]
    pub fn rewards_pools(&self) -> Vec<AddressAndAccount> {
        self.0
            .rewards_pools
            .clone()
            .into_iter()
            .map(|(pk, acc)| AddressAndAccount {
                address: Uint8Array::from(pk.to_bytes()),
                account: Account::from(acc),
            })
            .collect()
    }
    #[napi(getter)]
    pub fn ticks_per_slot(&self) -> u64 {
        self.0.ticks_per_slot.clone().into()
    }
    #[napi(getter)]
    pub fn unused(&self) -> u64 {
        self.0.unused.clone().into()
    }
    #[napi(getter)]
    pub fn poh_config(&self) -> PohConfig {
        self.0.poh_config.clone().into()
    }
    #[napi(getter)]
    pub fn fee_rate_governor(&self) -> FeeRateGovernor {
        self.0.fee_rate_governor.clone().into()
    }
    #[napi(getter)]
    pub fn rent(&self) -> Rent {
        self.0.rent.clone().into()
    }
    #[napi(getter)]
    pub fn inflation(&self) -> Inflation {
        self.0.inflation.clone().into()
    }
    #[napi(getter)]
    pub fn epoch_schedule(&self) -> EpochSchedule {
        self.0.epoch_schedule.clone().into()
    }
    #[napi(getter)]
    pub fn cluster_type(&self) -> String {
        match self.0.cluster_type {
            ClusterType::Development => "development",
            ClusterType::Devnet => "devnet",
            ClusterType::MainnetBeta => "mainnet-beta",
            ClusterType::Testnet => "testnet",
        }
        .to_string()
    }
}

#[derive(From, Into)]
#[napi]
pub struct ProgramTestContext(ProgramTestContextOriginal);

#[napi]
impl ProgramTestContext {
    #[napi(getter)]
    pub fn banks_client(&self) -> BanksClient {
        self.0.banks_client.clone().into()
    }

    #[napi(getter)]
    pub fn payer(&self) -> Uint8Array {
        self.0.payer.to_bytes().into()
    }

    #[napi(getter)]
    pub fn last_blockhash(&self) -> String {
        self.0.last_blockhash.to_string()
    }

    #[napi(getter)]
    pub fn genesis_config(&self) -> GenesisConfig {
        self.0.genesis_config().clone().into()
    }

    #[napi]
    pub fn set_account(&mut self, address: Uint8Array, account: &Account) {
        let acc_original: &AccountOriginal = account.as_ref();
        let acc_shared = AccountSharedData::from(acc_original.clone());
        self.0.set_account(&convert_pubkey(address), &acc_shared);
    }

    #[napi]
    pub fn set_clock(&mut self, clock: &Clock) {
        self.0.set_sysvar(&clock.0)
    }

    #[napi]
    pub fn set_rent(&mut self, rent: &Rent) {
        self.0.set_sysvar(&rent.0)
    }

    #[napi]
    pub fn warp_to_slot(&mut self, warp_slot: BigInt) -> Result<()> {
        self.0.warp_to_slot(warp_slot.get_u64().1).map_err(|e| {
            Error::new(
                Status::GenericFailure,
                format!("Failed to warp to slot: {e}"),
            )
        })
    }
}

fn new_bankrun(
    programs: Vec<(&str, Pubkey)>,
    compute_max_units: Option<u64>,
    transaction_account_lock_limit: Option<usize>,
    accounts: Vec<(Pubkey, Account)>,
) -> ProgramTest {
    let mut pt = ProgramTest::default();
    pt.prefer_bpf(true);
    for prog in programs {
        pt.add_program(prog.0, prog.1, None);
    }
    if let Some(cmu) = compute_max_units {
        pt.set_compute_max_units(cmu);
    }
    if let Some(lock_lim) = transaction_account_lock_limit {
        pt.set_transaction_account_lock_limit(lock_lim);
    }
    for acc in accounts {
        pt.add_account(acc.0, acc.1.into());
    }
    pt
}

#[napi]
pub async fn start_anchor(
    path: String,
    extra_programs: Vec<(&str, Uint8Array)>,
    accounts: Vec<(Uint8Array, &Account)>,
    compute_max_units: Option<BigInt>,
    transaction_account_lock_limit: Option<BigInt>,
) -> Result<ProgramTestContext> {
    let mut programs: Vec<(&str, Pubkey)> = extra_programs
        .iter()
        .map(|tup| (tup.0, Pubkey::try_from(tup.1.as_ref()).unwrap()))
        .collect();
    let mut sbf_out_dir: PathBuf = path.parse().unwrap();
    let mut anchor_toml_path = sbf_out_dir.clone();
    sbf_out_dir.push("target/deploy");
    anchor_toml_path.push("Anchor.toml");
    let toml_str = std::fs::read_to_string(anchor_toml_path)
        .map_err(|e| Error::new(Status::GenericFailure, format!("File not found: {e}")))?;
    let parsed_toml = Table::from_str(&toml_str).unwrap();
    let toml_programs_raw = parsed_toml
        .get("programs")
        .and_then(|x| x.get("localnet"))
        .ok_or_else(|| {
            Error::new(
                Status::GenericFailure,
                "`programs.localnet` not found in Anchor.toml",
            )
        })?;
    let toml_programs_parsed = toml_programs_raw.as_table().ok_or_else(|| {
        Error::new(
            Status::GenericFailure,
            "Failed to parse `programs.localnet` table.",
        )
    })?;
    for (key, val) in toml_programs_parsed {
        let pubkey_with_quotes = val.to_string();
        let pubkey_str = &pubkey_with_quotes[1..pubkey_with_quotes.len() - 1];
        let pk = Pubkey::from_str(pubkey_str).map_err(|_| {
            Error::new(
                Status::GenericFailure,
                format!("Invalid pubkey in `programs.localnet` table. {}", val),
            )
        })?;
        programs.push((key, pk));
    }
    std::env::set_var("SBF_OUT_DIR", sbf_out_dir);
    let parsed_accounts: Vec<(Pubkey, Account)> = accounts
        .iter()
        .map(|tup| (Pubkey::try_from(tup.0.as_ref()).unwrap(), tup.1.clone()))
        .collect();
    let pt = new_bankrun(
        programs,
        compute_max_units.map(|b| b.get_u64().1),
        transaction_account_lock_limit.map(|u| u.get_u64().1 as usize),
        parsed_accounts,
    );
    Ok(pt.start_with_context().await.into())
}

#[napi]
pub async fn start(
    programs: Vec<(&str, Uint8Array)>,
    accounts: Vec<(Uint8Array, &Account)>,
    compute_max_units: Option<BigInt>,
    transaction_account_lock_limit: Option<BigInt>,
) -> ProgramTestContext {
    let programs_converted = programs
        .iter()
        .map(|p| (p.0, convert_pubkey(p.1.clone())))
        .collect();
    let accounts_converted = accounts
        .iter()
        .map(|p| (convert_pubkey(p.0.clone()), p.1.clone()))
        .collect();
    let pt = new_bankrun(
        programs_converted,
        compute_max_units.map(|n| n.get_u64().1),
        transaction_account_lock_limit.map(|n| usize::try_from(n.get_u64().1).unwrap()),
        accounts_converted,
    );
    pt.start_with_context().await.into()
}
