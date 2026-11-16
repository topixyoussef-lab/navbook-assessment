import { network } from "hardhat";
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { parseAbi } from "viem";

describe("NavBook", async function () {
  const { viem, networkHelpers } = await network.create();
  const [owner, nonOwner] = await viem.getWalletClients();

  let navBook: any;

  async function deployNavBook() {
    const contract = await viem.deployContract("NavBook");
    return { navBook: contract };
  }

  beforeEach(async function () {
    const deployed = await networkHelpers.loadFixture(deployNavBook);
    navBook = deployed.navBook;
  });

  // Test constants - bytes32 must be 32-byte hex strings (66 chars with 0x prefix)
  const TODAY = 20261109;
  const ASSET_A = "0x0000000000000000000000000000000000000000000000000000000000000001";
  const ASSET_B = "0x0000000000000000000000000000000000000000000000000000000000000002";
  const ASSET_C = "0x0000000000000000000000000000000000000000000000000000000000000003";
  const ASSET_D = "0x0000000000000000000000000000000000000000000000000000000000000004";
  const UNKNOWN_ASSET = "0x0000000000000000000000000000000000000000000000000000000000000099";

  // ============================================================
  // POST MARK TESTS
  // ============================================================

  describe("postMark", () => {
    it("allows owner to post a mark", async () => {
      await navBook.write.postMark([ASSET_A, 1_000_00n, 20261109], { account: owner.account });

      const mark = await navBook.read.marks([ASSET_A]);
      assert.equal(mark[0], 1_000_00n);
      assert.equal(Number(mark[1]), 20261109);
    });

    it("emits MarkPosted event", async () => {
      await viem.assertions.emit(
        navBook.write.postMark([ASSET_A, 1_000_00n, 20261109], { account: owner.account }),
        navBook,
        "MarkPosted",
        [ASSET_A, 1_000_00n, 20261109]
      );
    });

    it("reverts when non-owner tries to post", async () => {
      await viem.assertions.revertWithCustomError(
        navBook.write.postMark([ASSET_A, 1_000_00n, 20261109], { account: nonOwner.account }),
        navBook,
        "OwnableUnauthorizedAccount"
      );
    });

    it("reverts when NAV is zero", async () => {
      await viem.assertions.revertWithCustomError(
        navBook.write.postMark([ASSET_A, 0n, 20261109], { account: owner.account }),
        navBook,
        "ZeroNav"
      );
    });

    it("reverts when date is in the future", async () => {
      await viem.assertions.revertWithCustomError(
        navBook.write.postMark([ASSET_A, 1_000_00n, 20991231], { account: owner.account }),
        navBook,
        "ImpossibleDate"
      );
    });

    it("reverts when date has invalid month (13)", async () => {
      await viem.assertions.revertWithCustomError(
        navBook.write.postMark([ASSET_A, 1_000_00n, 20261301], { account: owner.account }),
        navBook,
        "ImpossibleDate"
      );
    });

    it("reverts when date has invalid day (0)", async () => {
      await viem.assertions.revertWithCustomError(
        navBook.write.postMark([ASSET_A, 1_000_00n, 20261100], { account: owner.account }),
        navBook,
        "ImpossibleDate"
      );
    });

    it("reverts when date has invalid day (32)", async () => {
      await viem.assertions.revertWithCustomError(
        navBook.write.postMark([ASSET_A, 1_000_00n, 20261132], { account: owner.account }),
        navBook,
        "ImpossibleDate"
      );
    });

    it("reverts when year is too early", async () => {
      await viem.assertions.revertWithCustomError(
        navBook.write.postMark([ASSET_A, 1_000_00n, 19991231], { account: owner.account }),
        navBook,
        "ImpossibleDate"
      );
    });
  });

  // ============================================================
  // IS STALE TESTS
  // ============================================================

  describe("isStale", () => {
    it("returns true for missing mark", async () => {
      const result = await navBook.read.isStale([UNKNOWN_ASSET, TODAY]);
      assert.equal(result, true);
    });

    it("returns false for mark dated today (fresh)", async () => {
      await navBook.write.postMark([ASSET_A, 1_000_00n, TODAY], { account: owner.account });
      const result = await navBook.read.isStale([ASSET_A, TODAY]);
      assert.equal(result, false);
    });

    it("returns false for mark 3 days old (fresh)", async () => {
      await navBook.write.postMark([ASSET_B, 2_000_00n, 20261106], { account: owner.account });
      const result = await navBook.read.isStale([ASSET_B, TODAY]);
      assert.equal(result, false);
    });

    it("returns true for mark 4 days old (stale)", async () => {
      await navBook.write.postMark([ASSET_C, 3_000_00n, 20261105], { account: owner.account });
      const result = await navBook.read.isStale([ASSET_C, TODAY]);
      assert.equal(result, true);
    });
  });

  // ============================================================
  // TRADABLE NAV TESTS
  // ============================================================

  describe("tradableNav", () => {
    it("returns 0 for empty list", async () => {
      const result = await navBook.read.tradableNav([[], TODAY]);
      assert.equal(result, 0n);
    });

    it("sums fresh marks", async () => {
      await navBook.write.postMark([ASSET_A, 1_000_00n, TODAY], { account: owner.account });
      await navBook.write.postMark([ASSET_B, 2_000_00n, 20261106], { account: owner.account });

      const result = await navBook.read.tradableNav([[ASSET_A, ASSET_B], TODAY]);
      assert.equal(result, 3_000_00n);
    });

    it("skips stale marks", async () => {
      await navBook.write.postMark([ASSET_A, 1_000_00n, TODAY], { account: owner.account });
      await navBook.write.postMark([ASSET_C, 5_000_00n, 20261105], { account: owner.account });

      const result = await navBook.read.tradableNav([[ASSET_A, ASSET_C], TODAY]);
      assert.equal(result, 1_000_00n);
    });

    it("skips unknown assets", async () => {
      await navBook.write.postMark([ASSET_A, 1_000_00n, TODAY], { account: owner.account });

      const result = await navBook.read.tradableNav([[ASSET_A, UNKNOWN_ASSET], TODAY]);
      assert.equal(result, 1_000_00n);
    });

    it("skips both stale and unknown assets", async () => {
      await navBook.write.postMark([ASSET_A, 1_000_00n, TODAY], { account: owner.account });
      await navBook.write.postMark([ASSET_C, 5_000_00n, 20261105], { account: owner.account });

      const result = await navBook.read.tradableNav([[ASSET_A, ASSET_C, UNKNOWN_ASSET], TODAY]);
      assert.equal(result, 1_000_00n);
    });

    it("handles multiple assets with mixed fresh/stale/unknown", async () => {
      await navBook.write.postMark([ASSET_A, 1_000_00n, TODAY], { account: owner.account });
      await navBook.write.postMark([ASSET_B, 2_000_00n, 20261107], { account: owner.account });
      await navBook.write.postMark([ASSET_C, 3_000_00n, 20261108], { account: owner.account });
      await navBook.write.postMark([ASSET_D, 4_000_00n, 20261105], { account: owner.account });

      const result = await navBook.read.tradableNav([[ASSET_A, ASSET_B, ASSET_C, ASSET_D, UNKNOWN_ASSET], TODAY]);
      assert.equal(result, 6_000_00n);
    });
  });

  // ============================================================
  // EDGE CASE TESTS
  // ============================================================

  describe("edge cases", () => {
    it("overwrites previous mark for same asset", async () => {
      await navBook.write.postMark([ASSET_A, 1_000_00n, 20261106], { account: owner.account });
      await navBook.write.postMark([ASSET_A, 2_000_00n, TODAY], { account: owner.account });

      const isStale = await navBook.read.isStale([ASSET_A, TODAY]);
      assert.equal(isStale, false);

      const mark = await navBook.read.marks([ASSET_A]);
      assert.equal(mark[0], 2_000_00n);
    });
  });
});