import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { Raffle } from "../target/types/raffle";
import { BN } from "@project-serum/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import chai, { assert, expect } from "chai";
import { TOKEN_PROGRAM_ID } from "@project-serum/anchor/dist/cjs/utils/token";
import { ASSOCIATED_TOKEN_PROGRAM_ID, Token } from "@solana/spl-token";

describe("raffle", () => {
  // Configure the client to use the local cluster.

  const provider = anchor.getProvider();

  anchor.setProvider(provider);

  const connection = provider.connection;

  const program = anchor.workspace.Raffle as Program<Raffle>;

  const payer = anchor.web3.Keypair.generate();
  const bank = anchor.web3.Keypair.generate();
  const mint = new PublicKey("C4VW9CKc8mPBMmJsqDpTF24TwYpbLW1aTzhRevMfWUXi");

  before("fund wallet", async () => {
    const bankFund = await program.provider.connection.requestAirdrop(
      bank.publicKey,
      1000000000
    );

    const payerFund = await program.provider.connection.requestAirdrop(
      payer.publicKey,
      1000000000
    );
    await program.provider.connection.confirmTransaction(bankFund);
    await program.provider.connection.confirmTransaction(payerFund);
  });

  let tokenMint: PublicKey;

  before("create mint token", async () => {
    const token = await Token.createMint(
      connection,
      payer,
      payer.publicKey,
      payer.publicKey,
      0,
      TOKEN_PROGRAM_ID
    );
    const account = await token.createAssociatedTokenAccount(payer.publicKey);
    await token.mintTo(account, payer, [], 100);

    tokenMint = token.publicKey;

    console.log({
      tokenMint: token.publicKey.toBase58(),
      account: account.toBase58(),
    });
  });

  it("Is initialized!", async () => {
    // Add your test here.
    const tx = await program.rpc.initialize({});
    console.log("Your transaction signature", tx);
  });

  it("Create bank", async () => {
    console.log("bank address", bank.publicKey.toBase58());

    await program.rpc.initBank({
      accounts: {
        bank: bank.publicKey,
        bankManager: payer.publicKey,
        payer: payer.publicKey,
        systemProgram: SystemProgram.programId,
      },
      signers: [bank, payer],
    });

    const bankAccount = await program.account.bank.fetch(bank.publicKey);

    assert.equal(
      bankAccount.bankManager.toBase58(),
      payer.publicKey.toBase58()
    );

    assert(bankAccount.rafflesCount.eq(new BN(0)));
  });

  it("Create raffle", async () => {
    const [rafflePDA, _] = await PublicKey.findProgramAddress(
      [
        anchor.utils.bytes.utf8.encode("raffle"),
        bank.publicKey.toBuffer(),
        payer.publicKey.toBuffer(),
      ],
      program.programId
    );

    console.log({
      rafflePDA: rafflePDA.toBase58(),
      tokenMint: tokenMint.toBase58(),
    });

    await program.rpc.createRaffle(
      "Raffle 1",
      "valid-Url_afert",
      new BN(1),
      new BN(1650605069),
      new BN(1650605069),
      new BN(20),
      {
        accounts: {
          bank: bank.publicKey,
          raffle: rafflePDA,
          tokenMint: tokenMint,
          payer: payer.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        },
        signers: [payer],
      }
    );

    const raffleAccount = await program.account.raffle.fetch(rafflePDA);

    assert.equal(raffleAccount.name, "Raffle 1");
  });

  it.skip("Buy ticket", async () => {
    const [rafflePDA] = await PublicKey.findProgramAddress(
      [
        anchor.utils.bytes.utf8.encode("raffle"),
        bank.publicKey.toBuffer(),
        payer.publicKey.toBuffer(),
      ],
      program.programId
    );

    await program.rpc.createRaffle(
      "Raffle 2",
      "valid-Url_afert",
      new BN(1),
      new BN(1650605069),
      new BN(1650605069),
      new BN(10),
      {
        accounts: {
          bank: bank.publicKey,
          raffle: rafflePDA,
          tokenMint: tokenMint,
          payer: payer.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        },
        signers: [payer],
      }
    );

    const [ticketPDA, _] = await PublicKey.findProgramAddress(
      [
        anchor.utils.bytes.utf8.encode("tickets"),
        rafflePDA.toBuffer(),
        payer.publicKey.toBuffer(),
      ],
      program.programId
    );

    const [tokenAccountPDA, ___] = await PublicKey.findProgramAddress(
      [
        anchor.utils.bytes.utf8.encode("token_to_raffle"),
        rafflePDA.toBuffer(),
        ticketPDA.toBuffer(),
      ],
      program.programId
    );

    const tokenAccount = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      tokenMint,
      payer.publicKey
    );

    const tokenAccountB = await Token.getAssociatedTokenAddress(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      tokenMint,
      bank.publicKey
    );

    console.log({
      rafflePDA: rafflePDA.toBase58(),
      ticketPDA: ticketPDA.toBase58(),
      tokenAccountPDA: tokenAccountPDA.toBase58(),
      tokenAccount: tokenAccount.toBase58(),
      tokenAccountB: tokenAccountB.toBase58(),
    });

    await program.rpc.buyTickets(new BN(1), {
      accounts: {
        bank: tokenAccountB,
        raffle: rafflePDA,
        tickets: ticketPDA,
        tokenAccount: tokenAccount,
        payer: payer.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      },
      signers: [payer],
    });
  });
});