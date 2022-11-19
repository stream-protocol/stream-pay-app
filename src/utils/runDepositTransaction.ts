import {
  createTransferCheckedInstruction,
  getAssociatedTokenAddress,
  getMint,
  getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";
import { WalletContextState } from "@solana/wallet-adapter-react";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import BigNumber from "bignumber.js";
import base58 from "bs58";
import { couponAddress, tokenAddress } from "../data/addresses";
import { MyTransactionStatus } from "../types";

export async function runDepositTransaction(
  connection: Connection,
  wallet: WalletContextState,
  amount: BigNumber,
  reference: PublicKey
): Promise<MyTransactionStatus> {
  try {
    if (amount.toNumber() === 0) {
      return {
        status: false,
        message: "Can't checkout with charge of 0",
      };
    }

    if (!wallet.publicKey) {
      return {
        status: false,
        message: "No account provided",
      };
    }

    if (!reference) {
      return {
        status: false,
        message: "No reference provided",
      };
    }

    const shopPrivateKey = process.env.NEXT_PUBLIC_SHOP_PRIVATE_KEY as string;
    if (!shopPrivateKey) {
      return {
        status: false,
        message: "Shop private key is not available",
      };
    }

    const shopKeypair = Keypair.fromSecretKey(base58.decode(shopPrivateKey));
    const buyerPublicKey = wallet.publicKey;
    const shopPublicKey = shopKeypair.publicKey;

    const buyerTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      shopKeypair,
      tokenAddress,
      buyerPublicKey
    );
    const shopTokenAddress = await getAssociatedTokenAddress(
      tokenAddress,
      shopPublicKey
    );
    const tokenMint = await getMint(connection, tokenAddress);
    const couponMint = await getMint(connection, couponAddress);
    const buyerCouponAddress = await getAssociatedTokenAddress(
      couponAddress,
      buyerPublicKey
    );
    const shopCouponAddress = await getAssociatedTokenAddress(
      couponAddress,
      shopPublicKey
    );

    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash("finalized");
    const transaction = new Transaction({
      blockhash,
      lastValidBlockHeight,
      feePayer: shopPublicKey,
    });

    // Create the instruction to send WL token (DWLT) from the buyer to the shop
    const tokenInstruction = createTransferCheckedInstruction(
      buyerTokenAccount.address,
      tokenAddress,
      shopTokenAddress,
      buyerPublicKey,
      amount.multipliedBy(10 ** tokenMint.decimals).toNumber(),
      tokenMint.decimals
    );

    tokenInstruction.keys.push({
      pubkey: reference,
      isSigner: false,
      isWritable: false,
    });

    // Create the instruction to send Stream store token (SST) from the shop to the buyer
    const couponInstruction = createTransferCheckedInstruction(
      shopCouponAddress,
      couponAddress,
      buyerCouponAddress,
      shopPublicKey,
      amount.multipliedBy(10 ** couponMint.decimals).toNumber(),
      couponMint.decimals
    );

    couponInstruction.keys.push({
      pubkey: shopPublicKey,
      isSigner: true,
      isWritable: false,
    });

    // Instruction to send STR or SOL from the shop to the buyer
    const transferSolInstruction = SystemProgram.transfer({
      fromPubkey: shopPublicKey,
      toPubkey: buyerPublicKey,
      lamports: 100000,
    });

    transferSolInstruction.keys.push({
      pubkey: shopPublicKey,
      isSigner: true,
      isWritable: false,
    });

    // Add all instructions to the transaction
    transaction.add(
      couponInstruction,
      transferSolInstruction,
      tokenInstruction
    );

    transaction.partialSign(shopKeypair);

    await wallet.sendTransaction(transaction, connection, {
      preflightCommitment: "confirmed",
    });

    return {
      status: true,
      message: "Thanks for your purchase!",
    };
  } catch (err) {
    console.error(err);

    return {
      status: false,
      // @ts-ignore
      message: err.toString(),
    };
  }
}
