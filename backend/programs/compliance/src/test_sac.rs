//! In-process SAC for compliance unit tests at synthetic `DEMO_ASSET` address.
#![cfg(test)]

use soroban_sdk::{
    contract, contractimpl, contracttype, token::TokenInterface, Address, Env, MuxedAddress, String,
};

#[contracttype]
enum DataKey {
    Balance(Address),
    Allowance(Address, Address),
    EnforceRouter,
}

#[contract]
pub struct TestSac;

#[contractimpl]
impl TestSac {
    pub fn mint(env: Env, to: Address, amount: i128) {
        if amount <= 0 {
            panic!("amount must be positive");
        }
        let key = DataKey::Balance(to);
        let current: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        env.storage().persistent().set(&key, &(current + amount));
    }

    pub fn set_enforce_router(env: Env, enabled: bool) {
        env.storage()
            .instance()
            .set(&DataKey::EnforceRouter, &enabled);
    }

    pub fn enforce_router(env: Env) -> bool {
        env.storage()
            .instance()
            .get(&DataKey::EnforceRouter)
            .unwrap_or(false)
    }
}

#[contractimpl(contracttrait)]
impl TokenInterface for TestSac {
    fn allowance(env: Env, from: Address, spender: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Allowance(from, spender))
            .unwrap_or(0)
    }

    fn approve(env: Env, from: Address, spender: Address, amount: i128, _expiration_ledger: u32) {
        from.require_auth();
        env.storage()
            .persistent()
            .set(&DataKey::Allowance(from, spender), &amount);
    }

    fn balance(env: Env, id: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Balance(id))
            .unwrap_or(0)
    }

    fn transfer(env: Env, from: Address, to: MuxedAddress, amount: i128) {
        if Self::enforce_router(env.clone()) {
            panic!("direct transfer blocked: use compliant_transfer");
        }
        from.require_auth();
        if amount <= 0 {
            panic!("amount must be positive");
        }
        let to_addr = to.address();
        let from_key = DataKey::Balance(from.clone());
        let to_key = DataKey::Balance(to_addr.clone());
        let from_bal: i128 = env.storage().persistent().get(&from_key).unwrap_or(0);
        if from_bal < amount {
            panic!("insufficient balance");
        }
        let to_bal: i128 = env.storage().persistent().get(&to_key).unwrap_or(0);
        env.storage()
            .persistent()
            .set(&from_key, &(from_bal - amount));
        env.storage().persistent().set(&to_key, &(to_bal + amount));
    }

    fn transfer_from(env: Env, spender: Address, from: Address, to: Address, amount: i128) {
        spender.require_auth();
        let allowance_key = DataKey::Allowance(from.clone(), spender);
        let allowed: i128 = env.storage().persistent().get(&allowance_key).unwrap_or(0);
        if allowed < amount {
            panic!("insufficient allowance");
        }
        env.storage()
            .persistent()
            .set(&allowance_key, &(allowed - amount));
        let from_key = DataKey::Balance(from.clone());
        let to_key = DataKey::Balance(to.clone());
        let from_bal: i128 = env.storage().persistent().get(&from_key).unwrap_or(0);
        if from_bal < amount {
            panic!("insufficient balance");
        }
        let to_bal: i128 = env.storage().persistent().get(&to_key).unwrap_or(0);
        env.storage()
            .persistent()
            .set(&from_key, &(from_bal - amount));
        env.storage().persistent().set(&to_key, &(to_bal + amount));
    }

    fn burn(env: Env, from: Address, amount: i128) {
        from.require_auth();
        let key = DataKey::Balance(from);
        let bal: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        if bal < amount {
            panic!("insufficient balance");
        }
        env.storage().persistent().set(&key, &(bal - amount));
    }

    fn burn_from(env: Env, spender: Address, from: Address, amount: i128) {
        spender.require_auth();
        let allowance_key = DataKey::Allowance(from.clone(), spender);
        let allowed: i128 = env.storage().persistent().get(&allowance_key).unwrap_or(0);
        if allowed < amount {
            panic!("insufficient allowance");
        }
        env.storage()
            .persistent()
            .set(&allowance_key, &(allowed - amount));
        let key = DataKey::Balance(from);
        let bal: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        if bal < amount {
            panic!("insufficient balance");
        }
        env.storage().persistent().set(&key, &(bal - amount));
    }

    fn decimals(_env: Env) -> u32 {
        7
    }

    fn name(env: Env) -> String {
        String::from_str(&env, "Test SAC")
    }

    fn symbol(env: Env) -> String {
        String::from_str(&env, "TEST")
    }
}
