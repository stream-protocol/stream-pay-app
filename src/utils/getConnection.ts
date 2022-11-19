import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { clusterApiUrl, Connection } from "@solana/web3.js";

export function getConnection(): Connection {
  const connection = new Connection(clusterApiUrl(WalletAdapterNetwork.Devnet));
  return connection;
}
