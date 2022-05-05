use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::state::*;

impl<'info> BuyTickets<'info> {
  fn transfer_ctx(&self) -> CpiContext<'_, '_, '_, 'info, Transfer<'info>> {
    CpiContext::new(
      self.token_program.to_account_info(),
      Transfer {
        from: self.token_account.to_account_info(),
        to: self.bank_box.to_account_info(),
        authority: self.payer.to_account_info(),
      },
    )
  }
}

pub fn handler(ctx: Context<BuyTickets>, amount: u64) -> Result<()> {
  let raffle = &mut ctx.accounts.raffle;
  let tickets = &mut ctx.accounts.tickets;

  tickets.bump = *ctx.bumps.get("tickets").unwrap();
  // let _ = *ctx.bumps.get("token_to_raffle").unwrap();
  tickets.amount = amount;

  let price = amount * raffle.raffle_price;

  msg!(
    "gl you bought: {} tickets for the raffle: {}",
    amount,
    raffle.name
  );

  token::transfer(ctx.accounts.transfer_ctx(), price)?;

  Ok(())
}

#[derive(Accounts)]
pub struct BuyTickets<'info> {
  #[account(mut)]
  pub raffle: Box<Account<'info, Raffle>>,

  // bank
  #[account(mut)]
  pub bank: Box<Account<'info, Bank>>,

  #[account(mut)]
  pub payer: Signer<'info>,

  #[account(init, seeds = [
        b"tickets".as_ref(),
        raffle.key().as_ref(),
        payer.key().as_ref(),
    ],
    bump,
    payer = payer,
    space = 8 + std::mem::size_of::<Tickets>())]
  pub tickets: Account<'info, Tickets>,

  // #[account(init_if_needed, seeds = [
  //     b"bank_box".as_ref(),
  //     bank.key().as_ref(),
  //     raffle.token_mint.key().as_ref(),
  // ],
  // bump,
  // payer = payer, space = 8)]
  #[account(mut)]
  pub bank_box: Box<Account<'info, TokenAccount>>,

  // the token account of the user
  // #[account(mut, seeds = [
  //     b"token_to_raffle".as_ref(),
  //     raffle.key().as_ref(),
  //     tickets.key().as_ref(),
  // ],
  // bump)]
  #[account(mut)]
  pub token_account: Box<Account<'info, TokenAccount>>,

  // Misc.
  pub token_program: Program<'info, Token>,
  pub system_program: Program<'info, System>,
  pub rent: Sysvar<'info, Rent>,
}