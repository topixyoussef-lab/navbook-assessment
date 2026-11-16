import { network } from "hardhat";

async function main() {
  const { viem } = await network.create({ network: "localhost" });
  const publicClient = await viem.getPublicClient();
  const [deployer] = await viem.getWalletClients();
  
  console.log("Deployer:", deployer.account.address);

  // Deploy contract
  const navBook = await viem.deployContract("NavBook");
  console.log("Deployed to:", navBook.address);

  const ASSET_A = "0x0000000000000000000000000000000000000000000000000000000000000001";
  
  // Post a mark
  const hash = await navBook.write.postMark([ASSET_A, 100000n, 20261109n], { account: deployer.account });
  await publicClient.waitForTransactionReceipt({ hash });
  console.log("Mark posted! Tx:", hash);

  // Read the mark
  const mark = await navBook.read.marks([ASSET_A]);
  console.log("Mark navUsd:", mark[0].toString());
  console.log("Mark date:", mark[1].toString());

  // Check if stale (today)
  const isStale = await navBook.read.isStale([ASSET_A, 20261109]);
  console.log("Is Stale (today):", isStale);

  // Check tradable NAV
  const tradable = await navBook.read.tradableNav([[ASSET_A], 20261109]);
  console.log("Tradable NAV (today):", tradable.toString());

  // Test stale (4 days later)
  const isStaleOld = await navBook.read.isStale([ASSET_A, 20261113]);
  console.log("Is Stale (4 days later):", isStaleOld);

  // Test tradable with stale date
  const tradableStale = await navBook.read.tradableNav([[ASSET_A], 20261113]);
  console.log("Tradable NAV (4 days later):", tradableStale.toString());
}

main().catch(console.error);