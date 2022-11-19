import {
  createQR,
  encodeURL,
  findReference,
  FindReferenceError,
  TransactionRequestURLFields,
  validateTransfer,
  ValidateTransferError,
} from "@solana/pay";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Keypair } from "@solana/web3.js";
import { Button, Card, Tabs, useTheme } from "flowbite-react";
import { useRouter } from "next/router";
import { useEffect, useMemo, useRef } from "react";
import BackLink from "../components/BackLink";
import ClipboardCopy from "../components/ClipboardCopy";
import PageHeading from "../components/PageHeading";
import { tokenAddress, shopAddress } from "../data/addresses";
import {
  calculatePrice,
  notifyLoading,
  notifyUpdate,
  runDepositTransaction,
} from "../utils";

export default function Checkout() {
  const router = useRouter();
  const { connection } = useConnection();
  const wallet = useWallet();
  const { setVisible } = useWalletModal();
  const { mode } = useTheme();

  // ref to a dev where you will show QR code
  const qrRef = useRef<HTMLDivElement>(null);

  const amount = useMemo(() => calculatePrice(router.query), [router.query]);

  // Unique address that we can listen for payments to
  const reference = useMemo(() => Keypair.generate().publicKey, []);

  // Read the URL query (which includes our chosen products)
  const searchParams = useMemo(
    () => new URLSearchParams({ reference: reference.toString() }),
    [reference]
  );
  for (const [key, value] of Object.entries(router.query)) {
    if (value) {
      if (Array.isArray(value)) {
        for (const v of value) {
          searchParams.append(key, v);
        }
      } else {
        searchParams.append(key, value);
      }
    }
  }

  // Show the QR code
  useEffect(() => {
    // window.location is only available in the browser, so create the URL in here
    const { location } = window;
    const apiUrl = `${location.protocol}//${
      location.host
    }/api/makeTransaction?${searchParams.toString()}`;
    const urlParams: TransactionRequestURLFields = {
      link: new URL(apiUrl),
      label: "Depositing Stream Token(STR)",
      message: "Thanks for your purchase!",
    };

    const solanaUrl = encodeURL(urlParams);
    const qr = createQR(solanaUrl, 252, "transparent");
    if (qrRef.current && amount.isGreaterThan(0)) {
      qrRef.current.innerHTML = "";
      qr.append(qrRef.current);
    }
  }, [amount, searchParams]);

  // Check every 1s if the transaction is completed
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        // Check if there is any transaction for the reference
        const signatureInfo = await findReference(connection, reference, {
          finality: "confirmed",
        });
        // Validate that the transaction has the expected recipient, amount and Stream / SPL token
        await validateTransfer(
          connection,
          signatureInfo.signature,
          {
            recipient: shopAddress,
            amount: amount,
            splToken: tokenAddress,
            reference,
          },
          { commitment: "confirmed" }
        );

        router.push("/confirmed");
      } catch (err) {
        if (err instanceof FindReferenceError) {
          // No transaction found yet, ignore this error
          return;
        }
        if (err instanceof ValidateTransferError) {
          // Transaction is invalid
          console.error("Transaction is invalid", err);
          return;
        }
        console.error("Unknown error", err);
      }
    }, 1000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onDepositManually = async () => {
    const toastId = notifyLoading(
      "Transaction in progress. Please wait...",
      mode
    );
    const result = await runDepositTransaction(
      connection,
      wallet,
      amount,
      reference
    );
    notifyUpdate(toastId, result.message, result.status ? "success" : "error");
  };

  return (
    <div className="relative flex flex-col items-center gap-8">
      <BackLink href="/">Cancel</BackLink>
      <PageHeading>Deposit {amount.toString()} STR</PageHeading>
      <Card>
        <Tabs.Group style="underline" className="w-96" id="checkout-tab">
          <Tabs.Item title="Scan">
            <div className="flex justify-center my-8">
              {/* div added to display the QR code */}
              <div
                ref={qrRef}
                className="w-64 h-64 border-2 border-gray-400 rounded-xl bg-white"
              />
            </div>
          </Tabs.Item>
          <Tabs.Item title="Manual">
            <p className="text-md text-gray-500 dark:text-gray-400">
              Checkout payment manually
            </p>
            <div className="flex flex-col gap-4">
              <div>
                <p className="mt-4 mb-2 block text-gray-700 dark:text-gray-100">
                  Shop Address
                </p>
                <ClipboardCopy copyText={shopAddress.toString()} />
              </div>
              <p className="my-2 block text-gray-700 dark:text-gray-100">
                Amount:{" "}
                <span className="font-semibold">{amount.toString()} STR</span>
              </p>
              {wallet.connected ? (
                <Button
                  onClick={onDepositManually}
                  disabled={!wallet.publicKey || amount.toNumber() === 0}
                >
                  Deposit
                </Button>
              ) : (
                <Button onClick={() => setVisible(true)}>Connect</Button>
              )}
            </div>
          </Tabs.Item>
        </Tabs.Group>
      </Card>
    </div>
  );
}
