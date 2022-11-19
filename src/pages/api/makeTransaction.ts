import {
  createTransferCheckedInstruction,
  getAssociatedTokenAddress,
  getMint,
  getOrCreateAssociatedTokenAccount
} from "@solana/spl-token";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction
} from "@solana/web3.js";
import base58 from "bs58";
import { NextApiRequest, NextApiResponse } from "next";
import { couponAddress, tokenAddress } from "../../data/addresses";
import {
  ErrorOutput,
  MakeTransactionGetResponse,
  MakeTransactionInputData,
  MakeTransactionOutputData
} from "../../types";
import { calculatePrice, getConnection } from "../../utils";

function get(res: NextApiResponse<MakeTransactionGetResponse>) {
  res.status(200).json({
    label: "Depositing STR",
    icon: "https://i.imgur.com/XvrLRbL.png",
  });
}

async function post(
  req: NextApiRequest,
  res: NextApiResponse<MakeTransactionOutputData | ErrorOutput>
) {
  try {
    const amount = calculatePrice(req.query);
    if (amount.toNumber() === 0) {
      res.status(400).json({ error: "Can't checkout with charge of 0" });
      return;
    }

    const { reference } = req.query;
    if (!reference) {
      res.status(400).json({ error: "No reference provided" });
      return;
    }

    const { account } = req.body as MakeTransactionInputData;
    if (!account) {
      res.status(400).json({ error: "No account provided" });
      return;
    }

    const shopPrivateKey = process.env.NEXT_PUBLIC_SHOP_PRIVATE_KEY as string;
    if (!shopPrivateKey) {
      res.status(400).json({ error: "Shop private key is not available" });
      return;
    }

    const shopKeypair = Keypair.fromSecretKey(base58.decode(shopPrivateKey));
    const buyerPublicKey = new PublicKey(account);
    const shopPublicKey = shopKeypair.publicKey;

    const connection = getConnection();

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

    // Create the instruction to send Stream token (STR) from the buyer to the shop
    const tokenInstruction = createTransferCheckedInstruction(
      buyerTokenAccount.address,
      tokenAddress,
      shopTokenAddress,
      buyerPublicKey,
      amount.multipliedBy(10 ** tokenMint.decimals).toNumber(),
      tokenMint.decimals
    );

    tokenInstruction.keys.push({
      pubkey: new PublicKey(reference),
      isSigner: false,
      isWritable: false,
    });

    // Create the instruction to send Stream "store" token (STR) from the shop to the buyer   
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

    // Instruction to send STM or SOL from the shop to the buyer
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
    const serializedTransaction = transaction
      .serialize({ requireAllSignatures: false })
      .toString("base64");

    // Return the serialized transaction
    res.status(200).json({
      transaction: serializedTransaction,
      message: "Thanks for your purchase!",
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({ error: "error creating transaction" });
    return;
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<
    MakeTransactionGetResponse | MakeTransactionOutputData | ErrorOutput
  >
) {
  if (req.method === "get") {
    return get(res);
  } else if (req.method === "post") {
    return post(req, res);
  } else {
    return res.status(405).json({ error: "Method not allowed" });
  }
}
